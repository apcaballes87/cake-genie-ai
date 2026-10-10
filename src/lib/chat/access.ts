import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CHAT_SESSION_HEADER = 'x-chat-session';

export type ChatIdentity = {
  /** Supabase user id verified from the Authorization bearer token, never from the request body. */
  userId: string | null;
  /** True only for a verified user whose JWT carries app_metadata.genie_role = 'admin'. */
  isAdmin: boolean;
  /** Guest session id the browser keeps in localStorage and sends as a header. */
  sessionId: string | null;
};

type ConversationOwner = {
  user_id?: string | null;
  session_id?: string | null;
};

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Resolve who is calling. A bad or missing token yields an anonymous identity, not an error. */
export async function getChatIdentity(request: NextRequest, supabaseAdmin: SupabaseClient): Promise<ChatIdentity> {
  const sessionHeader = request.headers.get(CHAT_SESSION_HEADER)?.trim();
  const sessionId = sessionHeader ? sessionHeader.slice(0, 200) : null;
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token) {
    return { userId: null, isAdmin: false, sessionId };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return { userId: null, isAdmin: false, sessionId };
    }

    return {
      userId: data.user.id,
      isAdmin: data.user.app_metadata?.genie_role === 'admin',
      sessionId,
    };
  } catch {
    return { userId: null, isAdmin: false, sessionId };
  }
}

/** Admins, the signed-in owner, or the guest session that created the conversation. */
export function canAccessConversation(identity: ChatIdentity, conversation: ConversationOwner | null | undefined): boolean {
  if (!conversation) {
    return false;
  }
  if (identity.isAdmin) {
    return true;
  }
  if (identity.userId && conversation.user_id && safeEqual(identity.userId, conversation.user_id)) {
    return true;
  }
  if (identity.sessionId && conversation.session_id && safeEqual(identity.sessionId, conversation.session_id)) {
    return true;
  }
  return false;
}

/** Loads a conversation and checks access in one step. Returns null when missing OR forbidden (same answer on purpose). */
export async function loadAccessibleConversation(
  supabaseAdmin: SupabaseClient,
  identity: ChatIdentity,
  conversationId: unknown,
): Promise<{ id: string; user_id: string | null; session_id: string | null; bot_state: string | null } | null> {
  if (typeof conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return null;
  }

  const { data } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, user_id, session_id, bot_state')
    .eq('id', conversationId)
    .maybeSingle();

  return canAccessConversation(identity, data)
    ? (data as { id: string; user_id: string | null; session_id: string | null; bot_state: string | null })
    : null;
}
