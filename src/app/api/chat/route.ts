import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    const sessionId = searchParams.get('session_id');
    const userId = searchParams.get('user_id');

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

      await supabaseAdmin
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
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

      if (userId) {
        const { data: existing } = await supabaseAdmin
          .from('chat_conversations')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          conversation = existing;
        }
      } else if (sessionId) {
        const { data: existing } = await supabaseAdmin
          .from('chat_conversations')
          .select('id')
          .eq('session_id', sessionId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          conversation = existing;
        }
      }

      if (!conversation) {
        const { data: newConversation, error } = await supabaseAdmin
          .from('chat_conversations')
          .insert({
            user_id: userId || null,
            session_id: sessionId || null,
            customer_email: email || null,
            customer_name: name || null,
            status: 'active',
          })
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

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Unexpected error in POST /api/chat:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
