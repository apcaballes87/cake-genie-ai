-- Add user_id to discount_codes so signup-generated codes can be scoped
-- to a specific Supabase Auth user account.
-- Safe to run multiple times — IF NOT EXISTS prevents duplicate column errors.

ALTER TABLE public.discount_codes
    ADD COLUMN IF NOT EXISTS user_id UUID NULL;

-- Index for fast lookups by user (e.g. "does this user already have a code?")
CREATE INDEX IF NOT EXISTS idx_discount_codes_user_id
    ON public.discount_codes (user_id)
    WHERE user_id IS NOT NULL;
