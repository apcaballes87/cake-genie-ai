-- Migration: add abandoned cart email tracking table
-- File: supabase/migrations/20260612140000_add_abandoned_cart_tracking.sql

CREATE TABLE IF NOT EXISTS public.cakegenie_abandoned_cart_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.cakegenie_users(user_id) ON DELETE CASCADE,
    email_type VARCHAR(20) NOT NULL CHECK (email_type IN ('100_min', '18_hour')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for fast lookups
CREATE INDEX IF NOT EXISTS idx_abandoned_emails_user_type ON public.cakegenie_abandoned_cart_emails(user_id, email_type);
CREATE INDEX IF NOT EXISTS idx_abandoned_emails_sent_at ON public.cakegenie_abandoned_cart_emails(sent_at);

-- Comments for documentation
COMMENT ON TABLE public.cakegenie_abandoned_cart_emails IS 'Tracks sent abandoned cart follow-up emails to prevent duplicates and enable auditing.';
COMMENT ON COLUMN public.cakegenie_abandoned_cart_emails.user_id IS 'References the cakegenie_users table.';
COMMENT ON COLUMN public.cakegenie_abandoned_cart_emails.email_type IS 'The type of follow-up email sent (100_min or 18_hour).';
COMMENT ON COLUMN public.cakegenie_abandoned_cart_emails.sent_at IS 'Timestamp when the email log was recorded.';
