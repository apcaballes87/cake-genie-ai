import { NextResponse } from 'next/server';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminServerSupabaseClient();
    const runAt = new Date().toISOString();
    const { data, error } = await supabase.rpc('chatbot_minimize_expired_runs', {
      p_now: runAt,
    });

    if (error) throw error;

    return NextResponse.json({ minimized: data ?? 0, runAt });
  } catch (error) {
    console.error('Chatbot retention cron failed:', error);
    return NextResponse.json({ error: 'Retention job failed' }, { status: 500 });
  }
}
