-- Allow the deliberately sign-in-free dashboard to authenticate at the network
-- boundary without exposing a Supabase or Gemini credential to the browser.
-- Rows are service-only and store a one-way hash of the trusted public IP.
CREATE TABLE IF NOT EXISTS public.chatbot_admin_network_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_sha256 text NOT NULL CHECK (ip_sha256 ~ '^[0-9a-f]{64}$'),
  label text,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, ip_sha256)
);

COMMENT ON TABLE public.chatbot_admin_network_allowlist IS
  'Service-only trusted-network access for the sign-in-free Genie.ph admin dashboard.';

CREATE INDEX IF NOT EXISTS chatbot_admin_network_allowlist_ip_active_idx
  ON public.chatbot_admin_network_allowlist (ip_sha256)
  WHERE active;

DROP TRIGGER IF EXISTS chatbot_admin_network_allowlist_set_updated_at
  ON public.chatbot_admin_network_allowlist;
CREATE TRIGGER chatbot_admin_network_allowlist_set_updated_at
  BEFORE UPDATE ON public.chatbot_admin_network_allowlist
  FOR EACH ROW EXECUTE FUNCTION private.chatbot_set_updated_at();

ALTER TABLE public.chatbot_admin_network_allowlist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chatbot_admin_network_allowlist
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.chatbot_admin_network_allowlist TO service_role;
