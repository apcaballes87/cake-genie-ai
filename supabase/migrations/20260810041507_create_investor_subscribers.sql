-- Keep investor-update signups distinct from customer marketing signups,
-- which are coupled to discount-code issuance.
CREATE TABLE public.investor_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    source VARCHAR(50) NOT NULL DEFAULT 'investors-page',
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    privacy_notice_version VARCHAR(32) NOT NULL DEFAULT '2026-08-10',
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT investor_subscribers_email_lowercase CHECK (email = lower(email))
);

CREATE INDEX idx_investor_subscribers_active_created_at
    ON public.investor_subscribers (created_at DESC)
    WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.update_investor_subscribers_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_investor_subscribers_updated_at
    BEFORE UPDATE ON public.investor_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_investor_subscribers_updated_at_column();

ALTER TABLE public.investor_subscribers ENABLE ROW LEVEL SECURITY;

-- This table is written only through the server-side route handler. No public
-- policies means browser clients cannot read, write, or enumerate subscribers.
