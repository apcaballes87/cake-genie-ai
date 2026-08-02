-- Restore the customer-chat schema and access model used by the Telegram
-- notification release (8fb5fb25). This is intentionally forward-only: the
-- secure-chatbot migrations have already been applied in production, so their
-- migration history must remain intact.
--
-- This removes only the chatbot administration/draft-generation layer and
-- restores the legacy chat contracts consumed by the Telegram-era storefront
-- and admin dashboard.

-- Remove chatbot RPCs before their dependent tables.
DROP FUNCTION IF EXISTS public.chatbot_approve_run(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.chatbot_claim_run(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.chatbot_consume_rate_limit(text, timestamptz);
DROP FUNCTION IF EXISTS public.chatbot_minimize_expired_runs(timestamptz);
DROP FUNCTION IF EXISTS public.chatbot_publish_business_profile(uuid, uuid);
DROP FUNCTION IF EXISTS public.chatbot_publish_knowledge_entry(uuid, uuid);
DROP FUNCTION IF EXISTS public.chatbot_request_human(uuid, uuid);

-- Remove chatbot-only policies from the legacy tables before dropping the
-- staff registry they reference.
DROP POLICY IF EXISTS chat_conversations_customer_select ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conversations_staff_select ON public.chat_conversations;
DROP POLICY IF EXISTS chat_messages_customer_select ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_staff_select ON public.chat_messages;

-- The network allowlist belongs only to the removed no-sign-in chatbot-admin
-- bridge. It has no role in Telegram customer-chat notifications.
DROP TABLE IF EXISTS public.chatbot_admin_network_allowlist;

-- Drop all chatbot-owned data. Chat conversations and their legacy messages
-- are deliberately retained.
DROP TABLE IF EXISTS public.chatbot_feedback CASCADE;
DROP TABLE IF EXISTS public.chatbot_rate_limit_events CASCADE;
DROP TABLE IF EXISTS public.chatbot_runs CASCADE;
DROP TABLE IF EXISTS public.chatbot_knowledge_entries CASCADE;
DROP TABLE IF EXISTS public.chatbot_business_profile_versions CASCADE;
DROP TABLE IF EXISTS public.chatbot_settings CASCADE;
DROP TABLE IF EXISTS public.chatbot_audit_log CASCADE;
DROP TABLE IF EXISTS public.chatbot_admin_staff CASCADE;

DROP FUNCTION IF EXISTS private.chatbot_validate_run_message_links();
DROP FUNCTION IF EXISTS private.chatbot_set_updated_at();

-- Remove secure-chatbot-only message metadata and restore the legacy sender
-- contract. Production contains no assistant rows at this rollback point.
DROP INDEX IF EXISTS public.uq_chat_messages_conversation_client_message;
DROP INDEX IF EXISTS public.idx_chat_messages_reply_to_message_id;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_client_message_id_check,
  DROP CONSTRAINT IF EXISTS chat_messages_page_context_object_check,
  DROP CONSTRAINT IF EXISTS chat_messages_reply_to_message_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_messages_sender_type_check,
  ADD CONSTRAINT chat_messages_sender_type_check
    CHECK (sender_type IN ('customer', 'merchant', 'system')),
  DROP COLUMN IF EXISTS client_message_id,
  DROP COLUMN IF EXISTS reply_to_message_id,
  DROP COLUMN IF EXISTS page_context;

-- These five fields were introduced solely for chatbot automation. The page
-- context fields predate the chatbot and are retained for Telegram payloads.
ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_automation_mode_check,
  DROP CONSTRAINT IF EXISTS chat_conversations_handoff_state_check,
  DROP COLUMN IF EXISTS automation_mode,
  DROP COLUMN IF EXISTS handoff_state,
  DROP COLUMN IF EXISTS handoff_reason,
  DROP COLUMN IF EXISTS human_takeover_at,
  DROP COLUMN IF EXISTS assistant_reenabled_at;

-- Restore the original public customer-chat policies and grants. The
-- Telegram-era API routes use the service-role client; these permissions are
-- additionally required by the legacy browser Realtime/upload flows.
CREATE POLICY "Customers can create conversations" ON public.chat_conversations
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Customers can read own conversations" ON public.chat_conversations
  FOR SELECT TO public
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Customers can update own conversations" ON public.chat_conversations
  FOR UPDATE TO public
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Customers can create messages" ON public.chat_messages
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Customers can read own messages" ON public.chat_messages
  FOR SELECT TO public
  USING (
    conversation_id IN (
      SELECT id
      FROM public.chat_conversations
      WHERE user_id = auth.uid() OR user_id IS NULL
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.chat_conversations TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.chat_messages TO anon, authenticated;

-- Restore the helper RPCs removed by the chatbot migration, matching the
-- legacy signatures used by pre-chatbot callers.
CREATE OR REPLACE FUNCTION public.can_access_conversation(
  convo_id uuid,
  check_user_id uuid,
  check_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  convo_user_id uuid;
  convo_session_id text;
BEGIN
  SELECT user_id, session_id
  INTO convo_user_id, convo_session_id
  FROM public.chat_conversations
  WHERE id = convo_id;

  RETURN convo_user_id = check_user_id
    OR convo_session_id = check_session_id
    OR convo_user_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_customer_message(
  p_conversation_id uuid,
  p_content text,
  p_user_id uuid,
  p_session_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_can_send boolean;
BEGIN
  SELECT public.can_access_conversation(p_conversation_id, p_user_id, p_session_id)
  INTO v_can_send;

  IF NOT v_can_send THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.chat_messages (conversation_id, content, sender_type, is_read)
  VALUES (p_conversation_id, p_content, 'customer', false)
  RETURNING id INTO v_message_id;

  UPDATE public.chat_conversations
  SET updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_user_id uuid,
  p_session_id text,
  p_email text DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM public.chat_conversations
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT id INTO v_conversation_id
    FROM public.chat_conversations
    WHERE session_id = p_session_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.chat_conversations (
      user_id, session_id, customer_email, customer_name, status
    ) VALUES (
      p_user_id, p_session_id, p_email, p_name, 'active'
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_conversation(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_customer_message(uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid, text, text, text) TO anon, authenticated;

-- Restore the public bucket and client upload/read policies used by the
-- Telegram-era ChatModal. Existing objects remain in place.
UPDATE storage.buckets
SET public = true,
    file_size_limit = NULL,
    allowed_mime_types = NULL
WHERE id = 'chat-images';

CREATE POLICY chat_images_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'chat-images');

CREATE POLICY chat_images_upload ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'chat-images');
