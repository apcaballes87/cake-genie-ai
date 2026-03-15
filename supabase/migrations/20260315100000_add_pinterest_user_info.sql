-- Add Pinterest user account info to tokens table
ALTER TABLE public.cakegenie_pinterest_tokens
    ADD COLUMN IF NOT EXISTS pinterest_user_id TEXT,
    ADD COLUMN IF NOT EXISTS pinterest_username TEXT,
    ADD COLUMN IF NOT EXISTS pinterest_business_name TEXT,
    ADD COLUMN IF NOT EXISTS pinterest_account_type TEXT;
