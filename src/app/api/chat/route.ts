import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

type ChatPageContext = {
  url: string | null;
  title: string | null;
};

function normalizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizePageContext(value: unknown): ChatPageContext | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const url = normalizeOptionalString(raw.url, 2048);
  const title = normalizeOptionalString(raw.title, 255);

  if (!url && !title) {
    return null;
  }

  return {
    url,
    title,
  };
}

function buildConversationPageContextUpdate(pageContext: ChatPageContext | null) {
  if (!pageContext) {
    return {};
  }

  return {
    last_customer_page_url: pageContext.url,
    last_customer_page_title: pageContext.title,
    last_customer_page_seen_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');

    if (conversationId) {
      const { data: messages, error } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: messages || [] });
    }

    const { data: conversations, error } = await supabaseAdmin
      .from('chat_conversations')
      .select('*, chat_messages(*)')
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: conversations || [] });
  } catch (err) {
    console.error('Unexpected error in GET /api/chat:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, conversationId, sessionId, userId, content, email, name, imageUrl } = body;
    const pageContext = normalizePageContext(body.pageContext);

    if (action === 'send_message') {
      if (!content && !imageUrl || !conversationId) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const { data: message, error } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          content: content || '',
          image_url: imageUrl || null,
          sender_type: 'customer',
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const conversationUpdate = {
        updated_at: new Date().toISOString(),
        ...buildConversationPageContextUpdate(pageContext),
      };

      await supabaseAdmin
        .from('chat_conversations')
        .update(conversationUpdate)
        .eq('id', conversationId);

      return NextResponse.json({ success: true, data: message }, { status: 201 });
    }

    if (action === 'send_system_message') {
      if (!content || !conversationId) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const { data: message, error } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          content,
          sender_type: 'system',
          is_read: true,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await supabaseAdmin
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return NextResponse.json({ success: true, data: message }, { status: 201 });
    }

    if (action === 'start_conversation') {
      let conversation;

      let effectiveEmail = email || null;
      let effectiveName = name || null;

      if (userId && (!effectiveEmail || !effectiveName)) {
        try {
          const { data: userProfile } = await supabaseAdmin
            .from('cakegenie_users')
            .select('email, first_name, last_name')
            .eq('user_id', userId)
            .maybeSingle();

          if (userProfile) {
            if (!effectiveEmail && userProfile.email) {
              effectiveEmail = userProfile.email;
            }
            if (!effectiveName && userProfile.first_name) {
              effectiveName = `${userProfile.first_name}${userProfile.last_name ? ' ' + userProfile.last_name : ''}`.trim();
            }
          }
        } catch (profileError) {
          console.error('Error fetching cakegenie_users profile:', profileError);
        }
      }

      if (userId) {
        const { data: existing } = await supabaseAdmin
          .from('chat_conversations')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          conversation = existing;
        }
      }

      // Fallback to sessionId if no active conversation found for userId
      if (!conversation && sessionId) {
        const { data: existing } = await supabaseAdmin
          .from('chat_conversations')
          .select('*')
          .eq('session_id', sessionId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          conversation = existing;
        }
      }

      // Fallback to email if no active conversation found for userId or sessionId
      if (!conversation && effectiveEmail) {
        const { data: existing } = await supabaseAdmin
          .from('chat_conversations')
          .select('*')
          .eq('customer_email', effectiveEmail)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          conversation = existing;
        }
      }

      if (conversation) {
        // Sync user_id, session_id, customer_email, or customer_name if they are missing or changed
        const updates: any = {};
        
        if (userId && conversation.user_id !== userId) {
          updates.user_id = userId;
        }
        if (sessionId && conversation.session_id !== sessionId) {
          updates.session_id = sessionId;
        }
        if (effectiveEmail && conversation.customer_email !== effectiveEmail) {
          updates.customer_email = effectiveEmail;
        }
        if (effectiveName && conversation.customer_name !== effectiveName) {
          updates.customer_name = effectiveName;
        }

        const conversationUpdate = {
          updated_at: new Date().toISOString(),
          ...updates,
          ...buildConversationPageContextUpdate(pageContext),
        };

        const { data: updatedConvo, error: updateError } = await supabaseAdmin
          .from('chat_conversations')
          .update(conversationUpdate)
          .eq('id', conversation.id)
          .select()
          .single();

        if (!updateError && updatedConvo) {
          conversation = updatedConvo;
        }
      }

      if (!conversation) {
        const newConversationPayload = {
          user_id: userId || null,
          session_id: sessionId || null,
          customer_email: effectiveEmail || null,
          customer_name: effectiveName || null,
          status: 'active',
          ...buildConversationPageContextUpdate(pageContext),
        };

        const { data: newConversation, error } = await supabaseAdmin
          .from('chat_conversations')
          .insert(newConversationPayload)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        conversation = newConversation;

        await supabaseAdmin
          .from('chat_messages')
          .insert({
            conversation_id: conversation.id,
            content: 'Hi! How can we help you today?',
            sender_type: 'system',
            is_read: false,
          });
      }

      return NextResponse.json({ success: true, data: conversation }, { status: 201 });
    }

    if (action === 'mark_read') {
      if (!conversationId) {
        return NextResponse.json(
          { success: false, error: 'Missing conversationId' },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Unexpected error in POST /api/chat:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
