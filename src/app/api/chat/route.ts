import { createHash } from 'crypto';
import { after, NextRequest, NextResponse } from 'next/server';

import { createPendingChatbotRun, generateChatbotDraft, getChatbotSettings } from '@/lib/chatbot/assistant';
import { getChatImageObjectPath, isOwnedCustomerAttachmentPath } from '@/lib/chatbot/attachments';
import { normalizeCustomerMessage } from '@/lib/chatbot/guardrails';
import { sanitizeChatPageContext } from '@/lib/chatbot/pageContext';
import type { ChatbotRunRecord, ChatPageContext } from '@/lib/chatbot/types';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { triggerN8nWorkflow } from '@/services/n8nService';

export const maxDuration = 30;

type StoredCustomerMessage = {
  id: string;
  content?: string;
  image_url?: string | null;
  created_at?: string;
};

const IMAGE_ANALYSIS_NOTICES = {
  payment_receipt: 'Thanks for sending your payment screenshot. We received it and will confirm your payment shortly.',
  edible_photo_reference: 'Thanks for sending your edible photo image. We saved it and our team will check it for printing suitability.',
  not_a_cake: "Thanks for sending the image. If this is for cake pricing, please upload a single cake design. If it's for an edible photo or payment proof, you can send that too.",
  non_food: "Thanks for sending the image. If this is for cake pricing, please upload a single cake design. If it's for an edible photo or payment proof, you can send that too.",
  multiple_cakes: 'Please send one cake image at a time for price analysis so we can generate the correct customization link.',
  only_cupcakes: 'We can’t run price analysis on cupcake-only images in chat yet. Please send a full cake design instead.',
  complex_sculpture: 'Thanks for sending the cake design. This one is too complex for automatic chat analysis, so our team will review it manually.',
  large_wedding_cake: 'Thanks for sending the cake design. Large wedding cakes need manual review, so our team will check it and get back to you.',
  validation_fallback: "Thanks for sending the image. We couldn't automatically identify it yet. If this is for cake pricing, please upload a single cake design. If it's for an edible photo or payment proof, you can send that too.",
  manual_review: 'Thanks for sharing your cake image! Our team will review it and get back to you with pricing shortly.',
  finalizing: "⏳ I've analyzed your cake image! I'm finalizing the customization link and will send it here shortly.",
} as const;

function createImageAnalysisNotice(noticeType: unknown, slug: unknown): string | null {
  if (noticeType === 'analyzed') {
    return typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/i.test(slug)
      ? `🎂 Your cake image was analyzed. View and customize it here: https://genie.ph/customizing/${slug}`
      : null;
  }
  return typeof noticeType === 'string' && noticeType in IMAGE_ANALYSIS_NOTICES
    ? IMAGE_ANALYSIS_NOTICES[noticeType as keyof typeof IMAGE_ANALYSIS_NOTICES]
    : null;
}

async function getVerifiedUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}

async function getOwnedConversation(database: ReturnType<typeof createAdminServerSupabaseClient>, id: string, userId: string) {
  const { data, error } = await database
    .from('chat_conversations')
    .select('id, user_id, automation_mode, handoff_state, customer_name, customer_email, last_customer_page_url, last_customer_page_title')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return { conversation: data, error };
}

function getHashedIp(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
  return createHash('sha256')
    .update(`${process.env.CHATBOT_IP_HASH_SALT || 'genie-chat'}:${ip}`)
    .digest('hex');
}

async function notifyCustomerMessage({
  database,
  conversationId,
  message,
  pageContext,
}: {
  database: ReturnType<typeof createAdminServerSupabaseClient>;
  conversationId: string;
  message: StoredCustomerMessage;
  pageContext: ChatPageContext;
}) {
  const { data: conversation } = await database
    .from('chat_conversations')
    .select('customer_name, customer_email, last_customer_page_url, last_customer_page_title')
    .eq('id', conversationId)
    .maybeSingle();
  let notificationImageUrl = message.image_url || null;
  const notificationObjectPath = getChatImageObjectPath(notificationImageUrl);
  if (notificationObjectPath) {
    const { data: signed } = await database.storage.from('chat-images').createSignedUrl(notificationObjectPath, 3_600);
    notificationImageUrl = signed?.signedUrl || null;
  }
  const result = await triggerN8nWorkflow({
    event: 'customer_chat.message_created',
    data: {
      messageId: message.id,
      conversationId,
      senderType: 'customer',
      content: message.content || '',
      imageUrl: notificationImageUrl,
      customerName: conversation?.customer_name || null,
      customerEmail: conversation?.customer_email || null,
      pageUrl: `https://genie.ph${pageContext.pathname}`,
      pageTitle: null,
      createdAt: message.created_at || new Date().toISOString(),
    },
    metadata: { notificationChannel: 'telegram' },
  });
  if (!result.success) console.error('[customer-chat] Telegram notification workflow failed:', result.error);
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getVerifiedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const conversationId = new URL(request.url).searchParams.get('conversation_id');
    if (!conversationId) return NextResponse.json({ success: false, error: 'conversation_id is required' }, { status: 400 });

    const database = createAdminServerSupabaseClient();
    const { conversation } = await getOwnedConversation(database, conversationId, user.id);
    if (!conversation) return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    const { data: messages, error } = await database
      .from('chat_messages')
      .select('id, conversation_id, content, image_url, sender_type, created_at, is_read, reply_to_message_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ success: false, error: 'Unable to load messages' }, { status: 500 });
    const signedMessages = await Promise.all((messages || []).map(async (message) => {
      const objectPath = getChatImageObjectPath(message.image_url);
      if (!objectPath) return { ...message, image_url: null };
      const { data } = await database.storage.from('chat-images').createSignedUrl(objectPath, 3_600);
      return { ...message, image_url: data?.signedUrl || null };
    }));
    return NextResponse.json({ success: true, data: signedMessages });
  } catch (error) {
    console.error('Unexpected error in GET /api/chat:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getVerifiedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const database = createAdminServerSupabaseClient();
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
    const pageContext = sanitizeChatPageContext(body.pageContext);

    if (action === 'start_conversation') {
      const { data: existing } = await database
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        await database.from('chat_conversations').update({
          updated_at: new Date().toISOString(),
          last_customer_page_url: `https://genie.ph${pageContext.pathname}`,
          last_customer_page_title: null,
          last_customer_page_seen_at: new Date().toISOString(),
        }).eq('id', existing.id).eq('user_id', user.id);
        return NextResponse.json({ success: true, data: existing }, { status: 200 });
      }

      let customerName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;
      let customerEmail = user.email || null;
      const { data: profile } = await database
        .from('cakegenie_users')
        .select('email, first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        customerEmail = profile.email || customerEmail;
        customerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || customerName;
      }

      const { data: conversation, error } = await database
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          session_id: null,
          customer_email: customerEmail,
          customer_name: customerName,
          status: 'active',
          automation_mode: 'inherit',
          handoff_state: 'assistant',
          last_customer_page_url: `https://genie.ph${pageContext.pathname}`,
          last_customer_page_title: null,
          last_customer_page_seen_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error || !conversation) return NextResponse.json({ success: false, error: 'Unable to start conversation' }, { status: 500 });
      await database.from('chat_messages').insert({
        conversation_id: conversation.id,
        content: 'Hi! How can we help you today?',
        sender_type: 'system',
        is_read: false,
      });
      return NextResponse.json({ success: true, data: conversation }, { status: 201 });
    }

    if (!conversationId) return NextResponse.json({ success: false, error: 'conversationId is required' }, { status: 400 });
    const { conversation } = await getOwnedConversation(database, conversationId, user.id);
    if (!conversation) return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });

    if (action === 'send_message') {
      const content = normalizeCustomerMessage(body.content) || '';
      const imageUrl = typeof body.attachmentReference === 'string'
        && isOwnedCustomerAttachmentPath(body.attachmentReference, user.id, conversationId)
        ? body.attachmentReference.slice(0, 500)
        : null;
      const clientMessageId = typeof body.clientMessageId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(body.clientMessageId)
        ? body.clientMessageId
        : null;
      if ((!content && !imageUrl) || !clientMessageId) {
        return NextResponse.json({ success: false, error: 'Message and clientMessageId are required' }, { status: 400 });
      }

      const { data: idempotentMessage } = await database.from('chat_messages')
        .select('*').eq('conversation_id', conversationId).eq('client_message_id', clientMessageId).maybeSingle();
      if (idempotentMessage) {
        return NextResponse.json({ success: true, data: idempotentMessage, assistantDraftQueued: false });
      }

      const rateIdentifierHash = createHash('sha256')
        .update(`${user.id}:${getHashedIp(request)}`)
        .digest('hex');
      const { data: rateLimit, error: rateLimitError } = await database.rpc('chatbot_consume_rate_limit', {
        p_identifier_hash: rateIdentifierHash,
        p_now: new Date().toISOString(),
      });
      if (rateLimitError) {
        console.error('[chatbot] Durable rate limiter failed:', rateLimitError);
        return NextResponse.json({ success: false, error: 'Chat is temporarily unavailable. Please try again.' }, { status: 503 });
      }
      if (!rateLimit || (rateLimit as { allowed?: boolean }).allowed !== true) {
        return NextResponse.json({ success: false, error: 'Too many messages. Please try again later.' }, { status: 429 });
      }

      const { data: insertedMessage, error } = await database
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          content,
          image_url: imageUrl,
          sender_type: 'customer',
          is_read: false,
          client_message_id: clientMessageId,
          page_context: pageContext,
        })
        .select()
        .single();
      let message = insertedMessage as StoredCustomerMessage | null;
      let isNewMessage = true;
      if (error && (error as { code?: string }).code === '23505') {
        const { data: existingMessage } = await database
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('client_message_id', clientMessageId)
          .maybeSingle();
        message = existingMessage as StoredCustomerMessage | null;
        isNewMessage = false;
      } else if (error || !message) {
        return NextResponse.json({ success: false, error: 'Unable to store message' }, { status: 500 });
      }
      if (!message) return NextResponse.json({ success: false, error: 'Unable to store message' }, { status: 500 });

      await database.from('chat_conversations').update({
        updated_at: new Date().toISOString(),
        last_customer_page_url: `https://genie.ph${pageContext.pathname}`,
        last_customer_page_title: null,
        last_customer_page_seen_at: new Date().toISOString(),
      }).eq('id', conversationId).eq('user_id', user.id);

      let queuedRun: ChatbotRunRecord | null = null;
      let modelName = 'gemini-3.5-flash-lite';
      if (isNewMessage && content && conversation.handoff_state === 'assistant' && conversation.automation_mode !== 'off') {
        const settings = await getChatbotSettings(database);
        modelName = settings.modelName;
        if (!settings.killSwitch && settings.mode !== 'off') {
          const pending = await createPendingChatbotRun({
            database,
            conversationId,
            customerMessageId: message.id,
            modelName,
          });
          if (pending.created) queuedRun = pending.run;
        }
      }

      if (isNewMessage) {
        const requestContext = { headers: request.headers };
        after(async () => {
          await Promise.allSettled([
            notifyCustomerMessage({ database, conversationId, message: message!, pageContext }),
            ...(queuedRun ? [generateChatbotDraft({
              database,
              run: queuedRun,
              message: content,
              pageContext,
              modelName,
              requestContext,
            })] : []),
          ]);
        });
      }
      return NextResponse.json({ success: true, data: message, assistantDraftQueued: Boolean(queuedRun) }, { status: isNewMessage ? 201 : 200 });
    }

    if (action === 'get_image_analysis_notice') {
      const content = createImageAnalysisNotice(body.noticeType, body.slug);
      if (!content) return NextResponse.json({ success: false, error: 'Invalid image-analysis notice' }, { status: 400 });
      // This is deliberately response-only. A browser may request an allowlisted
      // notice, but it can never create a trusted system/assistant database row.
      return NextResponse.json({ success: true, data: { content } });
    }

    if (action === 'request_human') {
      const { data: confirmation, error: confirmationError } = await database.rpc('chatbot_request_human', {
        p_conversation_id: conversationId,
        p_user_id: user.id,
      });
      if (confirmationError || !confirmation) {
        return NextResponse.json({ success: false, error: 'Unable to request a staff reply' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: confirmation });
    }

    if (action === 'mark_read') {
      const { error } = await database.from('chat_messages').update({ is_read: true })
        .eq('conversation_id', conversationId).in('sender_type', ['merchant', 'assistant', 'system']).eq('is_read', false);
      if (error) return NextResponse.json({ success: false, error: 'Unable to mark messages read' }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Unexpected error in POST /api/chat:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
