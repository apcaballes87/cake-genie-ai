-- Secure, page-aware customer chatbot foundation.
--
-- This migration intentionally preserves legacy conversations whose user_id is
-- NULL. They remain available to trusted server/admin clients, but are no longer
-- visible through customer RLS. All new customer sessions must be represented by
-- a Supabase Auth user (including anonymous Auth users) and server routes must
-- derive that user_id from the verified session.

-- ---------------------------------------------------------------------------
-- Existing chat tables: additive columns and durable idempotency.
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS automation_mode text NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS handoff_state text NOT NULL DEFAULT 'assistant',
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS human_takeover_at timestamptz,
  ADD COLUMN IF NOT EXISTS assistant_reenabled_at timestamptz;

ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_automation_mode_check,
  ADD CONSTRAINT chat_conversations_automation_mode_check
    CHECK (automation_mode IN ('inherit', 'draft', 'auto', 'off')),
  DROP CONSTRAINT IF EXISTS chat_conversations_handoff_state_check,
  ADD CONSTRAINT chat_conversations_handoff_state_check
    CHECK (handoff_state IN ('assistant', 'requested', 'human'));

COMMENT ON COLUMN public.chat_conversations.automation_mode IS
  'Per-conversation override. inherit resolves through chatbot_settings.mode.';
COMMENT ON COLUMN public.chat_conversations.handoff_state IS
  'assistant permits draft generation; requested and human require staff handling.';
COMMENT ON COLUMN public.chat_conversations.user_id IS
  'Supabase Auth owner, including anonymous Auth users. NULL is retained only for legacy guest conversations.';

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS client_message_id text,
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid,
  ADD COLUMN IF NOT EXISTS page_context jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_type_check,
  ADD CONSTRAINT chat_messages_sender_type_check
    CHECK (sender_type IN ('customer', 'merchant', 'system', 'assistant')),
  DROP CONSTRAINT IF EXISTS chat_messages_client_message_id_check,
  ADD CONSTRAINT chat_messages_client_message_id_check
    CHECK (
      client_message_id IS NULL
      OR char_length(client_message_id) BETWEEN 1 AND 128
    ),
  DROP CONSTRAINT IF EXISTS chat_messages_page_context_object_check,
  ADD CONSTRAINT chat_messages_page_context_object_check
    CHECK (jsonb_typeof(page_context) = 'object'),
  DROP CONSTRAINT IF EXISTS chat_messages_reply_to_message_id_fkey,
  ADD CONSTRAINT chat_messages_reply_to_message_id_fkey
    FOREIGN KEY (reply_to_message_id)
    REFERENCES public.chat_messages(id)
    ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_messages_conversation_client_message
  ON public.chat_messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_message_id
  ON public.chat_messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

COMMENT ON COLUMN public.chat_messages.client_message_id IS
  'Caller-generated idempotency key, unique within one conversation.';
COMMENT ON COLUMN public.chat_messages.page_context IS
  'Immutable server-sanitized context snapshot captured with this message; never trust raw client URLs or prices.';

-- ---------------------------------------------------------------------------
-- Private staff registry and configuration/knowledge data.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chatbot_admin_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'support', 'knowledge_editor')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chatbot_admin_staff IS
  'Private chatbot staff role registry. Authorization must never use user_metadata.';

-- Bootstrap the known business owner without embedding a project-specific UUID.
-- Existing role assignments always win, making this safe to rerun.
INSERT INTO public.chatbot_admin_staff (
  user_id,
  role,
  active,
  created_by
)
SELECT
  id,
  'owner',
  true,
  id
FROM auth.users
WHERE lower(email) = 'alan@genie.ph'
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.chatbot_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  mode text NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'auto', 'off')),
  kill_switch boolean NOT NULL DEFAULT true,
  auto_send_intents text[] NOT NULL DEFAULT '{}'::text[],
  min_confidence numeric(4,3) NOT NULL DEFAULT 0.850
    CHECK (min_confidence BETWEEN 0 AND 1),
  model_name text NOT NULL DEFAULT 'gemini-3.5-flash-lite'
    CHECK (char_length(btrim(model_name)) BETWEEN 1 AND 120),
  run_retention_days integer NOT NULL DEFAULT 30
    CHECK (run_retention_days BETWEEN 1 AND 365),
  rollout_started_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chatbot_settings IS
  'Singleton global controls. mode=draft requires staff approval; kill_switch overrides all generation/sending.';

INSERT INTO public.chatbot_settings (
  id,
  mode,
  kill_switch,
  auto_send_intents,
  min_confidence,
  model_name,
  run_retention_days,
  rollout_started_at
)
VALUES (
  true,
  'draft',
  false,
  '{}'::text[],
  0.850,
  'gemini-3.5-flash-lite',
  30,
  now()
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.chatbot_business_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  legal_name text,
  address_line text NOT NULL CHECK (char_length(btrim(address_line)) BETWEEN 1 AND 500),
  hours_display text NOT NULL CHECK (char_length(btrim(hours_display)) BETWEEN 1 AND 255),
  operating_hours jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(operating_hours) = 'array'),
  support_email text NOT NULL CHECK (char_length(btrim(support_email)) BETWEEN 3 AND 320),
  phone_display text NOT NULL CHECK (char_length(btrim(phone_display)) BETWEEN 3 AND 80),
  phone_href text NOT NULL CHECK (char_length(btrim(phone_href)) BETWEEN 3 AND 120),
  map_url text NOT NULL CHECK (char_length(btrim(map_url)) BETWEEN 1 AND 2048),
  service_area text NOT NULL CHECK (char_length(btrim(service_area)) BETWEEN 1 AND 255),
  valid_from timestamptz,
  valid_until timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from),
  CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_business_profile_one_published
  ON public.chatbot_business_profile_versions ((status))
  WHERE status = 'published';

INSERT INTO public.chatbot_business_profile_versions (
  version,
  status,
  name,
  legal_name,
  address_line,
  hours_display,
  operating_hours,
  support_email,
  phone_display,
  phone_href,
  map_url,
  service_area,
  valid_from,
  published_at
)
VALUES (
  1,
  'published',
  'Genie.ph',
  'Alalai Information Technology Solutions',
  'Unit 3, Treehouse Building, R. Aboitiz St. Camputhaw, Cebu City, Cebu',
  'Mon - Sat: 9:00 AM - 6:00 PM',
  '[{"days":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"opens":"09:00","closes":"18:00","timezone":"Asia/Manila"}]'::jsonb,
  'support@genie.ph',
  '+63 908 940 8747',
  'tel:+639089408747',
  'https://www.google.com/maps/search/?api=1&query=Unit%203%2C%20Treehouse%20Building%2C%20R.%20Aboitiz%20St.%20Camputhaw%2C%20Cebu%20City%2C%20Cebu',
  'Metro Cebu',
  now(),
  now()
)
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.chatbot_knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_key text NOT NULL
    CHECK (knowledge_key = lower(knowledge_key) AND knowledge_key ~ '^[a-z0-9][a-z0-9_-]{1,119}$'),
  version integer NOT NULL CHECK (version > 0),
  category text NOT NULL CHECK (char_length(btrim(category)) BETWEEN 1 AND 80),
  locale text NOT NULL DEFAULT 'en'
    CHECK (char_length(btrim(locale)) BETWEEN 2 AND 20),
  question_patterns text[] NOT NULL DEFAULT '{}'::text[],
  answer text NOT NULL CHECK (char_length(btrim(answer)) BETWEEN 1 AND 4000),
  source_links jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(source_links) = 'array'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  valid_from timestamptz,
  valid_until timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (knowledge_key, locale, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from),
  CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_knowledge_one_published
  ON public.chatbot_knowledge_entries (knowledge_key, locale)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_published_lookup
  ON public.chatbot_knowledge_entries (category, locale, knowledge_key)
  WHERE status = 'published';

-- ---------------------------------------------------------------------------
-- Durable assistant runs, review feedback, and immutable audit evidence.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chatbot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  customer_message_id uuid NOT NULL UNIQUE REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  assistant_message_id uuid UNIQUE REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'draft', 'approved', 'rejected', 'sent', 'handoff', 'failed')),
  outcome text CHECK (outcome IN ('answer', 'clarify', 'handoff', 'refuse')),
  intent text,
  language text,
  draft_response text CHECK (draft_response IS NULL OR char_length(draft_response) <= 1000),
  final_response text CHECK (final_response IS NULL OR char_length(final_response) <= 1000),
  confidence numeric(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  model_name text,
  prompt_version text,
  knowledge_version text,
  source_ids text[] NOT NULL DEFAULT '{}'::text[],
  safety_flags text[] NOT NULL DEFAULT '{}'::text[],
  handoff_reason text,
  resolved_context jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(resolved_context) = 'object'),
  error_code text,
  error_message text,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.chatbot_rate_limit_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  identifier_hash text NOT NULL CHECK (char_length(identifier_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_rate_limit_events_identifier_created
  ON public.chatbot_rate_limit_events (identifier_hash, created_at DESC);

ALTER TABLE public.chatbot_runs ADD COLUMN IF NOT EXISTS lease_token uuid;
ALTER TABLE public.chatbot_runs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE public.chatbot_runs ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_chatbot_runs_conversation_created_at
  ON public.chatbot_runs (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatbot_runs_review_queue
  ON public.chatbot_runs (status, created_at)
  WHERE status IN ('draft', 'handoff', 'failed');

COMMENT ON COLUMN public.chatbot_runs.customer_message_id IS
  'Unique source message: retries reuse this run, providing exactly-once draft generation.';
COMMENT ON COLUMN public.chatbot_runs.assistant_message_id IS
  'NULL while draft-only. Set only after an approved/auto-sent assistant chat message exists.';

CREATE TABLE IF NOT EXISTS public.chatbot_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.chatbot_runs(id) ON DELETE CASCADE,
  feedback_type text NOT NULL
    CHECK (feedback_type IN ('approved_unchanged', 'approved_edited', 'rejected', 'helpful', 'unhelpful')),
  original_response text,
  edited_response text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_feedback_run_created_at
  ON public.chatbot_feedback (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chatbot_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(btrim(action)) BETWEEN 1 AND 120),
  entity_type text NOT NULL CHECK (char_length(btrim(entity_type)) BETWEEN 1 AND 120),
  entity_id uuid,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(before_state) = 'object'),
  CHECK (jsonb_typeof(after_state) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_chatbot_audit_entity_created_at
  ON public.chatbot_audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatbot_audit_actor_created_at
  ON public.chatbot_audit_log (actor_user_id, created_at DESC);

-- Validate that a run cannot point at messages from another conversation or
-- confuse customer and assistant sender roles.
CREATE OR REPLACE FUNCTION private.chatbot_validate_run_message_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_customer_sender text;
  v_customer_conversation_id uuid;
  v_assistant_sender text;
  v_assistant_conversation_id uuid;
BEGIN
  SELECT sender_type, conversation_id
  INTO v_customer_sender, v_customer_conversation_id
  FROM public.chat_messages
  WHERE id = NEW.customer_message_id;

  IF v_customer_sender IS DISTINCT FROM 'customer'
     OR v_customer_conversation_id IS DISTINCT FROM NEW.conversation_id THEN
    RAISE EXCEPTION 'customer_message_id must reference a customer message in the same conversation';
  END IF;

  IF NEW.assistant_message_id IS NOT NULL THEN
    SELECT sender_type, conversation_id
    INTO v_assistant_sender, v_assistant_conversation_id
    FROM public.chat_messages
    WHERE id = NEW.assistant_message_id;

    IF v_assistant_sender IS DISTINCT FROM 'assistant'
       OR v_assistant_conversation_id IS DISTINCT FROM NEW.conversation_id THEN
      RAISE EXCEPTION 'assistant_message_id must reference an assistant message in the same conversation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.chatbot_validate_run_message_links() FROM PUBLIC;

DROP TRIGGER IF EXISTS chatbot_runs_validate_message_links ON public.chatbot_runs;
CREATE TRIGGER chatbot_runs_validate_message_links
  BEFORE INSERT OR UPDATE OF conversation_id, customer_message_id, assistant_message_id
  ON public.chatbot_runs
  FOR EACH ROW
  EXECUTE FUNCTION private.chatbot_validate_run_message_links();

CREATE OR REPLACE FUNCTION private.chatbot_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.chatbot_set_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS chatbot_admin_staff_set_updated_at ON public.chatbot_admin_staff;
CREATE TRIGGER chatbot_admin_staff_set_updated_at
  BEFORE UPDATE ON public.chatbot_admin_staff
  FOR EACH ROW EXECUTE FUNCTION private.chatbot_set_updated_at();

DROP TRIGGER IF EXISTS chatbot_settings_set_updated_at ON public.chatbot_settings;
CREATE TRIGGER chatbot_settings_set_updated_at
  BEFORE UPDATE ON public.chatbot_settings
  FOR EACH ROW EXECUTE FUNCTION private.chatbot_set_updated_at();

DROP TRIGGER IF EXISTS chatbot_business_profile_set_updated_at ON public.chatbot_business_profile_versions;
CREATE TRIGGER chatbot_business_profile_set_updated_at
  BEFORE UPDATE ON public.chatbot_business_profile_versions
  FOR EACH ROW EXECUTE FUNCTION private.chatbot_set_updated_at();

DROP TRIGGER IF EXISTS chatbot_knowledge_set_updated_at ON public.chatbot_knowledge_entries;
CREATE TRIGGER chatbot_knowledge_set_updated_at
  BEFORE UPDATE ON public.chatbot_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION private.chatbot_set_updated_at();

DROP TRIGGER IF EXISTS chatbot_runs_set_updated_at ON public.chatbot_runs;
CREATE TRIGGER chatbot_runs_set_updated_at
  BEFORE UPDATE ON public.chatbot_runs
  FOR EACH ROW EXECUTE FUNCTION private.chatbot_set_updated_at();

-- Atomic, service-only publishing operations. The actor is checked against the
-- private staff registry even though the caller is already a trusted server.
CREATE OR REPLACE FUNCTION public.chatbot_publish_business_profile(
  p_profile_id uuid,
  p_actor_user_id uuid
)
RETURNS public.chatbot_business_profile_versions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile public.chatbot_business_profile_versions;
  v_before jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.chatbot_admin_staff
    WHERE user_id = p_actor_user_id
      AND active
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only active owners or admins may publish a business profile';
  END IF;

  -- Serialize the singleton activation so concurrent publishes cannot race the
  -- partial unique index.
  PERFORM pg_advisory_xact_lock(hashtextextended('chatbot_business_profile', 0));

  SELECT to_jsonb(p)
  INTO v_before
  FROM public.chatbot_business_profile_versions p
  WHERE p.status = 'published'
  FOR UPDATE;

  UPDATE public.chatbot_business_profile_versions
  SET status = 'archived',
      published_at = NULL
  WHERE status = 'published'
    AND id <> p_profile_id;

  UPDATE public.chatbot_business_profile_versions
  SET status = 'published',
      reviewed_by = p_actor_user_id,
      published_at = now()
  WHERE id = p_profile_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Business profile version not found';
  END IF;

  INSERT INTO public.chatbot_audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state
  ) VALUES (
    p_actor_user_id,
    'publish',
    'business_profile',
    v_profile.id,
    coalesce(v_before, '{}'::jsonb),
    to_jsonb(v_profile)
  );

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.chatbot_publish_knowledge_entry(
  p_entry_id uuid,
  p_actor_user_id uuid
)
RETURNS public.chatbot_knowledge_entries
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_entry public.chatbot_knowledge_entries;
  v_before jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.chatbot_admin_staff
    WHERE user_id = p_actor_user_id
      AND active
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only active owners or admins may publish knowledge';
  END IF;

  SELECT *
  INTO v_entry
  FROM public.chatbot_knowledge_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'Knowledge entry not found';
  END IF;

  -- Serialize only this logical entry/locale pair; unrelated knowledge may be
  -- published concurrently.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_entry.knowledge_key || ':' || v_entry.locale, 0)
  );

  SELECT to_jsonb(k)
  INTO v_before
  FROM public.chatbot_knowledge_entries k
  WHERE k.knowledge_key = v_entry.knowledge_key
    AND k.locale = v_entry.locale
    AND k.status = 'published'
  FOR UPDATE;

  UPDATE public.chatbot_knowledge_entries
  SET status = 'archived',
      published_at = NULL
  WHERE knowledge_key = v_entry.knowledge_key
    AND locale = v_entry.locale
    AND status = 'published'
    AND id <> p_entry_id;

  UPDATE public.chatbot_knowledge_entries
  SET status = 'published',
      reviewed_by = p_actor_user_id,
      published_at = now()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO public.chatbot_audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state
  ) VALUES (
    p_actor_user_id,
    'publish',
    'knowledge_entry',
    v_entry.id,
    coalesce(v_before, '{}'::jsonb),
    to_jsonb(v_entry)
  );

  RETURN v_entry;
END;
$$;

-- Approve and deliver a draft under one database transaction. Locking the
-- conversation before the run gives takeover/request-human updates the same
-- serialization point, so an assistant message cannot be inserted after a
-- handoff wins the race.
CREATE OR REPLACE FUNCTION public.chatbot_send_approved_draft(
  p_run_id uuid,
  p_answer text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_run public.chatbot_runs;
  v_conversation public.chat_conversations;
  v_message public.chat_messages;
  v_settings public.chatbot_settings;
  v_idempotent boolean := false;
  v_now timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chatbot_admin_staff
    WHERE user_id = p_actor_user_id
      AND active
      AND role IN ('owner', 'admin', 'support')
  ) THEN
    RAISE EXCEPTION 'Only active chat staff may approve drafts';
  END IF;

  IF p_answer IS NULL OR char_length(btrim(p_answer)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Approved answer must contain 1 to 1000 characters';
  END IF;

  SELECT * INTO v_run FROM public.chatbot_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Draft not found'; END IF;

  SELECT * INTO v_conversation
  FROM public.chat_conversations
  WHERE id = v_run.conversation_id
  FOR UPDATE;

  SELECT * INTO v_run
  FROM public.chatbot_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF v_run.assistant_message_id IS NOT NULL THEN
    SELECT * INTO v_message FROM public.chat_messages WHERE id = v_run.assistant_message_id;
    RETURN jsonb_build_object('run', to_jsonb(v_run), 'message', to_jsonb(v_message), 'idempotent', true);
  END IF;
  IF v_run.status <> 'draft' THEN RAISE EXCEPTION 'Draft is no longer approvable'; END IF;
  IF v_conversation.id IS NULL
    OR v_conversation.status = 'archived'
    OR v_conversation.handoff_state <> 'assistant'
    OR v_conversation.automation_mode = 'off'
  THEN
    RAISE EXCEPTION 'Assistant is not enabled for this conversation';
  END IF;

  SELECT * INTO v_settings FROM public.chatbot_settings WHERE id FOR UPDATE;
  IF v_settings.kill_switch OR v_settings.mode = 'off' THEN
    RAISE EXCEPTION 'Assistant sending is disabled';
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, content, sender_type, is_read, client_message_id, reply_to_message_id
  ) VALUES (
    v_run.conversation_id, btrim(p_answer), 'assistant', false,
    'chatbot-run-' || v_run.id::text, v_run.customer_message_id
  )
  ON CONFLICT (conversation_id, client_message_id) DO NOTHING
  RETURNING * INTO v_message;

  IF v_message.id IS NULL THEN
    SELECT * INTO v_message
    FROM public.chat_messages
    WHERE conversation_id = v_run.conversation_id
      AND client_message_id = 'chatbot-run-' || v_run.id::text;
    v_idempotent := true;
  END IF;

  UPDATE public.chatbot_runs
  SET assistant_message_id = v_message.id,
      status = 'sent',
      final_response = btrim(p_answer),
      reviewed_by = p_actor_user_id,
      reviewed_at = v_now,
      completed_at = v_now,
      updated_at = v_now
  WHERE id = v_run.id
  RETURNING * INTO v_run;

  UPDATE public.chat_conversations SET updated_at = v_now WHERE id = v_run.conversation_id;

  INSERT INTO public.chatbot_feedback (
    run_id, feedback_type, original_response, edited_response, created_by
  ) VALUES (
    v_run.id,
    CASE WHEN btrim(p_answer) = v_run.draft_response THEN 'approved_unchanged' ELSE 'approved_edited' END,
    v_run.draft_response,
    CASE WHEN btrim(p_answer) = v_run.draft_response THEN NULL ELSE btrim(p_answer) END,
    p_actor_user_id
  );

  INSERT INTO public.chatbot_audit_log (
    actor_user_id, action, entity_type, entity_id, before_state, after_state, metadata
  ) VALUES (
    p_actor_user_id, 'run.approve', 'chatbot_run', v_run.id, '{}'::jsonb, to_jsonb(v_run),
    jsonb_build_object('edited', btrim(p_answer) <> v_run.draft_response)
  );

  RETURN jsonb_build_object('run', to_jsonb(v_run), 'message', to_jsonb(v_message), 'idempotent', v_idempotent);
END;
$$;

CREATE OR REPLACE FUNCTION public.chatbot_send_eligible_auto_draft(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_run public.chatbot_runs;
  v_conversation public.chat_conversations;
  v_message public.chat_messages;
  v_settings public.chatbot_settings;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_run FROM public.chatbot_runs WHERE id = p_run_id;
  IF v_run.id IS NULL THEN RETURN jsonb_build_object('sent', false, 'reason', 'run_not_found'); END IF;

  SELECT * INTO v_conversation
  FROM public.chat_conversations
  WHERE id = v_run.conversation_id
  FOR UPDATE;
  SELECT * INTO v_run FROM public.chatbot_runs WHERE id = p_run_id FOR UPDATE;
  SELECT * INTO v_settings FROM public.chatbot_settings WHERE id FOR UPDATE;

  IF v_run.status <> 'draft'
    OR v_run.outcome <> 'answer'
    OR cardinality(v_run.safety_flags) <> 0
    OR v_conversation.id IS NULL
    OR v_conversation.status = 'archived'
    OR v_conversation.handoff_state <> 'assistant'
    OR v_conversation.automation_mode = 'off'
    OR v_settings.kill_switch
    OR NOT (
      v_conversation.automation_mode = 'auto'
      OR (v_conversation.automation_mode = 'inherit' AND v_settings.mode = 'auto')
    )
    OR NOT (v_run.intent = ANY(v_settings.auto_send_intents))
    OR coalesce(v_run.confidence, 0) < v_settings.min_confidence
  THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'not_eligible');
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, content, sender_type, is_read, client_message_id, reply_to_message_id
  ) VALUES (
    v_run.conversation_id, v_run.draft_response, 'assistant', false,
    'chatbot-run-' || v_run.id::text, v_run.customer_message_id
  )
  ON CONFLICT (conversation_id, client_message_id) DO NOTHING
  RETURNING * INTO v_message;
  IF v_message.id IS NULL THEN
    SELECT * INTO v_message FROM public.chat_messages
    WHERE conversation_id = v_run.conversation_id
      AND client_message_id = 'chatbot-run-' || v_run.id::text;
  END IF;

  UPDATE public.chatbot_runs
  SET status = 'sent', assistant_message_id = v_message.id,
      final_response = v_run.draft_response, completed_at = v_now, updated_at = v_now
  WHERE id = v_run.id
  RETURNING * INTO v_run;
  UPDATE public.chat_conversations SET updated_at = v_now WHERE id = v_run.conversation_id;
  INSERT INTO public.chatbot_audit_log (action, entity_type, entity_id, after_state)
  VALUES ('run.auto_send', 'chatbot_run', v_run.id, to_jsonb(v_run));
  RETURN jsonb_build_object('sent', true, 'run', to_jsonb(v_run), 'message', to_jsonb(v_message));
END;
$$;

-- Invoked by a trusted scheduled/server job. This keeps intent, outcome,
-- confidence, latency, safety flags, timestamps, and audit rows for aggregate
-- reporting while removing response text and resolved customer context after
-- the configured retention window.
CREATE OR REPLACE FUNCTION public.chatbot_minimize_expired_runs(
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_retention_days integer;
  v_cutoff timestamptz;
  v_minimized_count integer;
BEGIN
  SELECT run_retention_days
  INTO v_retention_days
  FROM public.chatbot_settings
  WHERE id;

  v_retention_days := coalesce(v_retention_days, 30);
  v_cutoff := p_now - make_interval(days => v_retention_days);

  UPDATE public.chatbot_runs
  SET draft_response = NULL,
      final_response = NULL,
      error_message = NULL,
      resolved_context = '{}'::jsonb
  WHERE created_at < v_cutoff
    AND (
      draft_response IS NOT NULL
      OR final_response IS NOT NULL
      OR error_message IS NOT NULL
      OR resolved_context <> '{}'::jsonb
    );

  GET DIAGNOSTICS v_minimized_count = ROW_COUNT;

  IF v_minimized_count > 0 THEN
    INSERT INTO public.chatbot_audit_log (
      action,
      entity_type,
      metadata
    ) VALUES (
      'retention_minimize',
      'chatbot_runs',
      jsonb_build_object(
        'cutoff', v_cutoff,
        'retention_days', v_retention_days,
        'minimized_count', v_minimized_count
      )
    );
  END IF;

  RETURN v_minimized_count;
END;
$$;

-- Atomically claim a reviewed draft, serialize against staff takeover on the
-- conversation row, insert exactly one assistant message, and finalize the
-- durable run. This closes the approve-versus-takeover race in HTTP handlers.
CREATE OR REPLACE FUNCTION public.chatbot_approve_run(
  p_run_id uuid,
  p_answer text,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_run public.chatbot_runs%ROWTYPE;
  v_conversation public.chat_conversations%ROWTYPE;
  v_message public.chat_messages%ROWTYPE;
  v_settings public.chatbot_settings%ROWTYPE;
  v_now timestamptz := now();
  v_client_message_id text;
BEGIN
  p_answer := btrim(coalesce(p_answer, ''));
  IF char_length(p_answer) < 1 OR char_length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'answer must contain between 1 and 1000 characters';
  END IF;

  IF p_reviewer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chatbot_admin_staff
    WHERE user_id = p_reviewer_id
      AND active
      AND role IN ('owner', 'admin', 'support')
  ) THEN
    RAISE EXCEPTION 'reviewer is not authorized to approve drafts';
  END IF;

  SELECT * INTO v_run
  FROM public.chatbot_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft not found';
  END IF;

  IF v_run.assistant_message_id IS NOT NULL THEN
    SELECT * INTO v_message
    FROM public.chat_messages
    WHERE id = v_run.assistant_message_id;
    RETURN jsonb_build_object('run', to_jsonb(v_run), 'message', to_jsonb(v_message), 'idempotent', true);
  END IF;

  IF v_run.status <> 'draft' THEN
    RAISE EXCEPTION 'draft is no longer approvable';
  END IF;

  SELECT * INTO v_conversation
  FROM public.chat_conversations
  WHERE id = v_run.conversation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_conversation.status = 'archived'
     OR v_conversation.handoff_state <> 'assistant'
     OR v_conversation.automation_mode = 'off' THEN
    RAISE EXCEPTION 'assistant is not enabled for this conversation';
  END IF;

  SELECT * INTO v_settings
  FROM public.chatbot_settings
  WHERE id
  FOR SHARE;

  IF NOT FOUND OR v_settings.kill_switch OR v_settings.mode = 'off' THEN
    RAISE EXCEPTION 'assistant sending is disabled';
  END IF;

  IF p_reviewer_id IS NULL AND (
    v_run.outcome <> 'answer'
    OR cardinality(v_run.safety_flags) <> 0
    OR NOT (
      v_conversation.automation_mode = 'auto'
      OR (v_conversation.automation_mode = 'inherit' AND v_settings.mode = 'auto')
    )
    OR NOT (v_run.intent = ANY(v_settings.auto_send_intents))
    OR coalesce(v_run.confidence, 0) < v_settings.min_confidence
  ) THEN
    RAISE EXCEPTION 'draft is not eligible for auto-send';
  END IF;

  v_client_message_id := 'chatbot-run-' || v_run.id::text;
  INSERT INTO public.chat_messages (
    conversation_id,
    content,
    sender_type,
    is_read,
    client_message_id,
    reply_to_message_id
  ) VALUES (
    v_run.conversation_id,
    p_answer,
    'assistant',
    false,
    v_client_message_id,
    v_run.customer_message_id
  )
  ON CONFLICT (conversation_id, client_message_id)
    WHERE client_message_id IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_message;

  IF v_message.id IS NULL THEN
    SELECT * INTO v_message
    FROM public.chat_messages
    WHERE conversation_id = v_run.conversation_id
      AND client_message_id = v_client_message_id;
  END IF;

  UPDATE public.chatbot_runs
  SET assistant_message_id = v_message.id,
      status = 'sent',
      final_response = p_answer,
      reviewed_by = p_reviewer_id,
      reviewed_at = CASE WHEN p_reviewer_id IS NULL THEN NULL ELSE v_now END,
      completed_at = v_now,
      updated_at = v_now
  WHERE id = v_run.id
  RETURNING * INTO v_run;

  UPDATE public.chat_conversations
  SET updated_at = v_now
  WHERE id = v_run.conversation_id;

  IF p_reviewer_id IS NOT NULL THEN
    INSERT INTO public.chatbot_feedback (
      run_id, feedback_type, original_response, edited_response, created_by
    ) VALUES (
      v_run.id,
      CASE WHEN p_answer = v_run.draft_response THEN 'approved_unchanged' ELSE 'approved_edited' END,
      v_run.draft_response,
      CASE WHEN p_answer = v_run.draft_response THEN NULL ELSE p_answer END,
      p_reviewer_id
    );
  END IF;

  INSERT INTO public.chatbot_audit_log (
    actor_user_id, action, entity_type, entity_id, before_state, after_state, metadata
  ) VALUES (
    p_reviewer_id,
    CASE WHEN p_reviewer_id IS NULL THEN 'run.auto_send' ELSE 'run.approve' END,
    'chatbot_run',
    v_run.id,
    '{}'::jsonb,
    to_jsonb(v_run),
    jsonb_build_object('edited', p_answer <> v_run.draft_response)
  );

  RETURN jsonb_build_object('run', to_jsonb(v_run), 'message', to_jsonb(v_message), 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.chatbot_claim_run(
  p_run_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 300
)
RETURNS public.chatbot_runs
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.chatbot_runs
  SET status = 'generating',
      lease_token = p_lease_token,
      lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 900))),
      attempt_count = attempt_count + 1,
      error_code = NULL,
      error_message = NULL,
      updated_at = now()
  WHERE id = p_run_id
    AND (
      status = 'pending'
      OR (status = 'generating' AND coalesce(lease_expires_at, '-infinity'::timestamptz) <= now())
    )
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.chatbot_consume_rate_limit(
  p_identifier_hash text,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_minute_count integer;
  v_hour_count integer;
BEGIN
  IF p_identifier_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid rate-limit identifier';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_identifier_hash, 0));

  DELETE FROM public.chatbot_rate_limit_events
  WHERE created_at < p_now - interval '1 hour';

  SELECT
    count(*) FILTER (WHERE created_at >= p_now - interval '1 minute'),
    count(*)
  INTO v_minute_count, v_hour_count
  FROM public.chatbot_rate_limit_events
  WHERE identifier_hash = p_identifier_hash
    AND created_at >= p_now - interval '1 hour';

  IF v_minute_count >= 5 OR v_hour_count >= 30 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'minuteCount', v_minute_count,
      'hourCount', v_hour_count
    );
  END IF;

  INSERT INTO public.chatbot_rate_limit_events (identifier_hash, created_at)
  VALUES (p_identifier_hash, p_now);

  RETURN jsonb_build_object(
    'allowed', true,
    'minuteCount', v_minute_count + 1,
    'hourCount', v_hour_count + 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chatbot_request_human(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_conversation public.chat_conversations%ROWTYPE;
  v_message public.chat_messages%ROWTYPE;
  v_now timestamptz := now();
  v_client_message_id text := 'human-request-' || p_conversation_id::text;
BEGIN
  SELECT * INTO v_conversation
  FROM public.chat_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND OR v_conversation.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  UPDATE public.chat_conversations
  SET handoff_state = 'requested',
      handoff_reason = 'customer_requested_human',
      updated_at = v_now
  WHERE id = p_conversation_id;

  UPDATE public.chatbot_runs
  SET status = 'handoff',
      handoff_reason = 'customer_requested_human',
      updated_at = v_now
  WHERE conversation_id = p_conversation_id
    AND status IN ('pending', 'generating', 'draft');

  INSERT INTO public.chat_messages (
    conversation_id,
    content,
    sender_type,
    is_read,
    client_message_id
  ) VALUES (
    p_conversation_id,
    'Your request has been handed to our team. A staff member will reply here.',
    'system',
    false,
    v_client_message_id
  )
  ON CONFLICT (conversation_id, client_message_id)
    WHERE client_message_id IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_message;

  IF v_message.id IS NULL THEN
    SELECT * INTO v_message
    FROM public.chat_messages
    WHERE conversation_id = p_conversation_id
      AND client_message_id = v_client_message_id;
  END IF;

  INSERT INTO public.chatbot_audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_user_id,
    'conversation.customer_handoff',
    'chat_conversation',
    p_conversation_id,
    jsonb_build_object('reason', 'customer_requested_human')
  );

  RETURN to_jsonb(v_message);
END;
$$;

REVOKE ALL ON FUNCTION public.chatbot_publish_business_profile(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_publish_knowledge_entry(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_send_approved_draft(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_send_eligible_auto_draft(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_minimize_expired_runs(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_approve_run(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_claim_run(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_consume_rate_limit(text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chatbot_request_human(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chatbot_publish_business_profile(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_publish_knowledge_entry(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_send_approved_draft(uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_send_eligible_auto_draft(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_minimize_expired_runs(timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_approve_run(uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_claim_run(uuid, uuid, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_consume_rate_limit(text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.chatbot_request_human(uuid, uuid)
  TO service_role;

-- Superseded within this migration by chatbot_approve_run, which covers both
-- reviewed and eligible auto-send paths with one lock/order contract.
DROP FUNCTION public.chatbot_send_approved_draft(uuid, text, uuid);
DROP FUNCTION public.chatbot_send_eligible_auto_draft(uuid);

-- ---------------------------------------------------------------------------
-- Customer RLS: authenticated ownership reads only; writes are server routes.
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_admin_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_business_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_rate_limit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Customers can read own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Customers can update own conversations" ON public.chat_conversations;

CREATE POLICY chat_conversations_customer_select
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Customers can create messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Customers can read own messages" ON public.chat_messages;

CREATE POLICY chat_messages_customer_select
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations conversation
      WHERE conversation.id = chat_messages.conversation_id
        AND conversation.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY chat_conversations_staff_select
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chatbot_admin_staff staff
      WHERE staff.user_id = (SELECT auth.uid())
        AND staff.active
        AND staff.role IN ('owner', 'admin', 'support')
    )
  );

CREATE POLICY chat_messages_staff_select
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chatbot_admin_staff staff
      WHERE staff.user_id = (SELECT auth.uid())
        AND staff.active
        AND staff.role IN ('owner', 'admin', 'support')
    )
  );

CREATE POLICY chatbot_admin_staff_self_select
  ON public.chatbot_admin_staff
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.chat_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_conversations TO authenticated;
GRANT SELECT ON TABLE public.chat_messages TO authenticated;

REVOKE ALL ON TABLE public.chatbot_admin_staff FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chatbot_admin_staff TO authenticated;

REVOKE ALL ON TABLE public.chatbot_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatbot_business_profile_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatbot_knowledge_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatbot_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatbot_feedback FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatbot_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatbot_rate_limit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.chatbot_rate_limit_events_id_seq FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.chat_conversations TO service_role;
GRANT ALL ON TABLE public.chat_messages TO service_role;
GRANT ALL ON TABLE public.chatbot_admin_staff TO service_role;
GRANT ALL ON TABLE public.chatbot_settings TO service_role;
GRANT ALL ON TABLE public.chatbot_business_profile_versions TO service_role;
GRANT ALL ON TABLE public.chatbot_knowledge_entries TO service_role;
GRANT ALL ON TABLE public.chatbot_runs TO service_role;
GRANT ALL ON TABLE public.chatbot_feedback TO service_role;
GRANT ALL ON TABLE public.chatbot_audit_log TO service_role;
GRANT ALL ON TABLE public.chatbot_rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chatbot_rate_limit_events_id_seq TO service_role;

-- Retire the legacy RPCs that trusted caller-provided user/session identifiers.
DROP FUNCTION IF EXISTS public.send_customer_message(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.get_or_create_conversation(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.can_access_conversation(uuid, uuid, text);

-- ---------------------------------------------------------------------------
-- Private customer attachments. Existing objects are retained in-place.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'chat-images',
  'chat-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS chat_images_public_read ON storage.objects;
DROP POLICY IF EXISTS chat_images_upload ON storage.objects;

COMMENT ON TABLE public.chatbot_runs IS
  'Minimized, durable assistant-generation record. Retain detailed payloads according to chatbot_settings.run_retention_days.';
