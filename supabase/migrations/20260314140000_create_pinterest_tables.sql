-- Create Pinterest tables for token persistence and pin tracking

-- Table for storing Pinterest OAuth tokens
CREATE TABLE IF NOT EXISTS public.cakegenie_pinterest_tokens (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for tracking pinned products to enforce daily limits and avoid duplicates
CREATE TABLE IF NOT EXISTS public.cakegenie_pinterest_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    p_hash TEXT NOT NULL,
    pinterest_pin_id TEXT,
    board_id TEXT,
    pinned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Optional, but good practice if not using Service Role everywhere)
ALTER TABLE public.cakegenie_pinterest_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cakegenie_pinterest_pins ENABLE ROW LEVEL SECURITY;

-- If you want the Service Role key to work, no policies needed if using Service Role. 
-- Otherwise, add specific policies.
