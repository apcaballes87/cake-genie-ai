import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

import { getChatImageObjectPath, isOwnedCustomerAttachmentPath } from '@/lib/chatbot/attachments';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const path = getChatImageObjectPath(searchParams.get('path'));
    if (!conversationId || !path) {
      return NextResponse.json({ success: false, error: 'Invalid attachment reference' }, { status: 400 });
    }
    const database = createAdminServerSupabaseClient();
    const { data: conversation } = await database.from('chat_conversations')
      .select('id').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 });
    }
    const isOwnedPath = isOwnedCustomerAttachmentPath(path, user.id, conversationId);
    if (!isOwnedPath) {
      const { data: messageRows } = await database.from('chat_messages')
        .select('image_url').eq('conversation_id', conversationId).not('image_url', 'is', null);
      const isReferencedByOwnedMessage = (messageRows || []).some((row) => (
        getChatImageObjectPath(row.image_url) === path
      ));
      if (!isReferencedByOwnedMessage) {
        return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 });
      }
    }
    const { data, error } = await database.storage.from('chat-images').createSignedUrl(path, 3_600);
    if (error || !data?.signedUrl) return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: { signedUrl: data.signedUrl } });
  } catch (error) {
    console.error('Unexpected error in GET /api/chat/attachments:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const formData = await request.formData();
    const conversationId = formData.get('conversationId');
    const file = formData.get('file');
    if (typeof conversationId !== 'string' || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'conversationId and file are required' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ success: false, error: 'Unsupported image type or size' }, { status: 400 });
    }

    const database = createAdminServerSupabaseClient();
    const { data: conversation } = await database.from('chat_conversations')
      .select('id').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
    if (!conversation) return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });

    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height || metadata.width > 8_000 || metadata.height > 8_000) {
        throw new Error('Invalid image dimensions');
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid image data' }, { status: 400 });
    }

    const path = `${user.id}/${conversationId}/${randomUUID()}.${EXTENSION_BY_MIME[file.type]}`;
    const { error } = await database.storage.from('chat-images').upload(path, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) return NextResponse.json({ success: false, error: 'Unable to upload image' }, { status: 500 });
    const { data: signed } = await database.storage.from('chat-images').createSignedUrl(path, 3_600);
    return NextResponse.json({ success: true, data: { reference: path, signedUrl: signed?.signedUrl || null } }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/chat/attachments:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
