import { NextResponse } from 'next/server';

import { generateChatbotDraft } from '@/lib/chatbot/assistant';
import { sanitizeChatPageContext } from '@/lib/chatbot/pageContext';
import type { ChatbotRunRecord } from '@/lib/chatbot/types';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RecoverableRun = ChatbotRunRecord & { model_name?: string | null };
type StoredMessage = { id: string; content?: string | null; page_context?: unknown };

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const database = createAdminServerSupabaseClient();
    const now = new Date().toISOString();
    const [pendingResult, staleResult] = await Promise.all([
      database.from('chatbot_runs').select('id, conversation_id, customer_message_id, status, model_name')
        .eq('status', 'pending').order('created_at', { ascending: true }).limit(10),
      database.from('chatbot_runs').select('id, conversation_id, customer_message_id, status, model_name')
        .eq('status', 'generating').lt('lease_expires_at', now).order('created_at', { ascending: true }).limit(10),
    ]);
    if (pendingResult.error || staleResult.error) throw pendingResult.error || staleResult.error;

    const runs = [...(pendingResult.data || []), ...(staleResult.data || [])] as RecoverableRun[];
    const uniqueRuns = [...new Map(runs.map((run) => [run.id, run])).values()];
    if (uniqueRuns.length === 0) return NextResponse.json({ recovered: 0, attempted: 0, runAt: now });

    const messageIds = uniqueRuns.map((run) => run.customer_message_id);
    const { data: messages, error: messageError } = await database.from('chat_messages')
      .select('id, content, page_context').in('id', messageIds);
    if (messageError) throw messageError;
    const byId = new Map(((messages || []) as StoredMessage[]).map((message) => [message.id, message]));

    const work = uniqueRuns.flatMap((run) => {
      const message = byId.get(run.customer_message_id);
      if (!message?.content) return [];
      return [generateChatbotDraft({
        database,
        run,
        message: message.content,
        pageContext: sanitizeChatPageContext(message.page_context),
        modelName: run.model_name || 'gemini-3.5-flash-lite',
      })];
    });
    const results = await Promise.allSettled(work);
    return NextResponse.json({
      recovered: results.filter((result) => result.status === 'fulfilled').length,
      attempted: results.length,
      runAt: now,
    });
  } catch (error) {
    console.error('Chatbot recovery cron failed:', error);
    return NextResponse.json({ error: 'Recovery job failed' }, { status: 500 });
  }
}
