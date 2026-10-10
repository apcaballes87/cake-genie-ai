-- Customer chat assistant: additive state + audit log.
-- Bot replies keep sender_type = 'merchant' (so the existing CHECK constraint,
-- realtime handling and admin UI keep working) and are flagged with is_bot.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS bot_state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bot_state_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_bot_state_check,
  ADD CONSTRAINT chat_conversations_bot_state_check
    CHECK (bot_state IN ('active', 'handed_off', 'off'));

COMMENT ON COLUMN public.chat_messages.is_bot IS
  'True when the message was written by the AI assistant rather than a human admin.';
COMMENT ON COLUMN public.chat_conversations.bot_state IS
  'active = assistant may answer; handed_off = waiting on a human; off = assistant disabled for this conversation.';

CREATE TABLE IF NOT EXISTS public.chat_bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('reply', 'handoff', 'silent', 'skipped', 'error')),
  category text,
  confidence numeric,
  reason text,
  reply text,
  model text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_bot_events_conversation
  ON public.chat_bot_events (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_bot_events_action_created
  ON public.chat_bot_events (action, created_at DESC);

-- Service-role only: RLS on with no policies exposes nothing to anon/authenticated.
ALTER TABLE public.chat_bot_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.chat_bot_events IS
  'Audit log of every AI assistant decision (reply / handoff / silent / skipped) for review and tuning.';
