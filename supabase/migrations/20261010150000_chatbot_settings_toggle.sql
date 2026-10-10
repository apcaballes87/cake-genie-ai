-- Global on/off switch for the customer chat assistant, controlled from the
-- admin dashboard's customer chats page. Single row (id = 1). Off by default.
-- The Next.js server reads it with the service role; dashboard admins
-- (JWT app_metadata.genie_role = 'admin') can read and update it directly.

CREATE TABLE IF NOT EXISTS public.chatbot_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.chatbot_settings (id, enabled) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chatbot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS genie_admin_select_chatbot_settings ON public.chatbot_settings;
CREATE POLICY genie_admin_select_chatbot_settings ON public.chatbot_settings
  FOR SELECT TO authenticated
  USING ((SELECT private.is_genie_admin()));

DROP POLICY IF EXISTS genie_admin_update_chatbot_settings ON public.chatbot_settings;
CREATE POLICY genie_admin_update_chatbot_settings ON public.chatbot_settings
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_genie_admin()))
  WITH CHECK ((SELECT private.is_genie_admin()));

CREATE OR REPLACE FUNCTION public.chatbot_settings_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chatbot_settings_touch ON public.chatbot_settings;
CREATE TRIGGER chatbot_settings_touch
  BEFORE UPDATE ON public.chatbot_settings
  FOR EACH ROW EXECUTE FUNCTION public.chatbot_settings_touch();

COMMENT ON TABLE public.chatbot_settings IS
  'Single-row global switch for the AI customer chat assistant. enabled=false means the bot never replies.';
