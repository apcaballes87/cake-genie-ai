-- Add discount_code column to newsletter subscribers so each subscriber
-- gets a tracked, unique discount code that can be re-displayed on re-visit.
ALTER TABLE public.cakegenie_newsletter_subscribers
    ADD COLUMN IF NOT EXISTS discount_code VARCHAR(20);
