-- Tighten newsletter subscribers RLS.
-- The original migration allowed ANY authenticated user full access.
-- Drop that policy and replace with:
--   * anon/public can INSERT only (controlled signup path)
--   * service_role bypasses RLS for API routes
--   * no SELECT/UPDATE/DELETE for regular authenticated users

-- Drop the permissive policy
DROP POLICY IF EXISTS "Allow authenticated to manage newsletter subscribers"
    ON public.cakegenie_newsletter_subscribers;

-- Drop the old insert policy too — we'll recreate a cleaner one
DROP POLICY IF EXISTS "Allow public insert to newsletter subscribers"
    ON public.cakegenie_newsletter_subscribers;

-- Anon and authenticated users can insert their own email (signup path)
CREATE POLICY "newsletter_insert_only"
    ON public.cakegenie_newsletter_subscribers
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Only service_role (used by /api/newsletter and /api/signup-discount) can
-- select/update. Regular users cannot read the subscriber list.
-- (service_role bypasses RLS entirely, so no explicit policy needed for it.)
