import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { id } = await params;

    const { data: conversation, error: convoError } = await supabaseAdmin
      .from('chat_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convoError || !conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    const { data: messages, error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) {
      return NextResponse.json({ success: false, error: msgError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { conversation, messages: messages || [] },
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/chat/[id]:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, content, status } = body;

    if (action === 'send_merchant_reply') {
      if (!content) {
        return NextResponse.json(
          { success: false, error: 'Message content required' },
          { status: 400 }
        );
      }

      const { data: message, error } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          conversation_id: id,
          content,
          sender_type: 'merchant',
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
        .eq('id', id);

      return NextResponse.json({ success: true, data: message });
    }

    if (action === 'update_status') {
      if (!status || !['active', 'closed', 'archived'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        );
      }

      const { data: updated, error } = await supabaseAdmin
        .from('chat_conversations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'mark_read') {
      const { error } = await supabaseAdmin
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .eq('is_read', false);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Unexpected error in PATCH /api/chat/[id]:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
