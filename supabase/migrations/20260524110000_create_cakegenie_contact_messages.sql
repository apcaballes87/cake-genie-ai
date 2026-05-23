CREATE TABLE IF NOT EXISTS public.cakegenie_contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'contact-page',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cakegenie_contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_contact_messages_insert" ON public.cakegenie_contact_messages;
CREATE POLICY "service_role_contact_messages_insert"
    ON public.cakegenie_contact_messages
    FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_contact_messages_select" ON public.cakegenie_contact_messages;
CREATE POLICY "service_role_contact_messages_select"
    ON public.cakegenie_contact_messages
    FOR SELECT
    TO service_role
    USING (true);
