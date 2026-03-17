-- Create newsletter subscribers table
CREATE TABLE IF NOT EXISTS public.cakegenie_newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    source VARCHAR(50) DEFAULT 'popup',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.cakegenie_newsletter_subscribers(email);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_newsletter_subscribers_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_newsletter_subscribers_updated_at
    BEFORE UPDATE ON public.cakegenie_newsletter_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_newsletter_subscribers_updated_at_column();

-- Enable RLS
ALTER TABLE public.cakegenie_newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Create policy for anon/authenticated users to insert their emails
CREATE POLICY "Allow public insert to newsletter subscribers"
    ON public.cakegenie_newsletter_subscribers
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Create policy for authenticated admins (or specific roles) to read/manage emails
CREATE POLICY "Allow authenticated to manage newsletter subscribers"
    ON public.cakegenie_newsletter_subscribers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
