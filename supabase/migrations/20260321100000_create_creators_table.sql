-- Create the creators table
CREATE TABLE IF NOT EXISTS public.creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    address TEXT NOT NULL,

    -- Social Media Handles
    tiktok_handle TEXT,
    instagram_handle TEXT,
    youtube_handle TEXT,
    facebook_handle TEXT,

    -- Social Media Follower Counts (Optional)
    tiktok_followers INTEGER,
    instagram_followers INTEGER,
    youtube_followers INTEGER,
    facebook_followers INTEGER,

    promo_code TEXT NOT NULL UNIQUE,
    agreed_to_terms BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Constraint to ensure at least one social handle is provided
ALTER TABLE public.creators
ADD CONSTRAINT at_least_one_social_handle
CHECK (
    tiktok_handle IS NOT NULL OR
    instagram_handle IS NOT NULL OR
    youtube_handle IS NOT NULL OR
    facebook_handle IS NOT NULL
);

-- RLS Policies
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Allow public insert to creators" ON public.creators
    FOR INSERT
    WITH CHECK (true);

-- Allow admins to read/update (assuming standard admin role setup, if not just keep readable to authenticated or service role)
-- For this application we'll rely on the service role for admin reads/updates if needed
CREATE POLICY "Allow service role full access to creators" ON public.creators
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_creators_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_creators_updated_at_trigger
    BEFORE UPDATE ON public.creators
    FOR EACH ROW
    EXECUTE FUNCTION update_creators_updated_at();

-- Index for unique promo_code lookup
CREATE INDEX IF NOT EXISTS creators_promo_code_idx ON public.creators(promo_code);
