-- Closes public read access that existed only so the old service-key-less dashboard
-- could work, and removes the guest-readable chat rules. Apply AFTER the new
-- storefront (chat API + widget polling + email RPC) and the new dashboard (Supabase
-- Auth login) are deployed.

-- 1) Narrow replacement for the storefront's "is this email taken by another account?"
--    check, so cakegenie_users no longer needs to be publicly readable.
CREATE OR REPLACE FUNCTION public.email_registered_to_other_user(p_email text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cakegenie_users u
    WHERE u.email = p_email
      AND u.user_id IS DISTINCT FROM p_user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.email_registered_to_other_user(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_registered_to_other_user(text, uuid) TO anon, authenticated;

-- 2) Customer names, emails, phones and delivery addresses were readable by anyone
--    holding the public anon key. Owners keep their own-row policies; the dashboard
--    uses the genie_admin_dashboard_* policies.
DROP POLICY IF EXISTS "Allow public read access for dashboard" ON public.cakegenie_users;
DROP POLICY IF EXISTS "Allow public select for dashboard" ON public.cakegenie_addresses;

-- 3) Chats: guests could read every guest conversation (user_id IS NULL) and anyone could
--    insert messages. All customer writes go through /api/chat (service role) now, and
--    guests read through the authenticated API. Signed-in customers may still read their own.
DROP POLICY IF EXISTS "Customers can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Customers can read own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Customers can update own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Customers can create messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Customers can read own messages" ON public.chat_messages;

CREATE POLICY "Signed-in customers can read own conversations" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Signed-in customers can read own messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT c.id FROM public.chat_conversations c WHERE c.user_id = (SELECT auth.uid())
    )
  );
