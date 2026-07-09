CREATE TABLE IF NOT EXISTS public.cakegenie_supplier_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewing', 'approved', 'rejected', 'archived')),
    name TEXT NOT NULL CHECK (char_length(btrim(name)) >= 2),
    contact_number TEXT NOT NULL CHECK (char_length(btrim(contact_number)) >= 7),
    business_name TEXT NOT NULL CHECK (char_length(btrim(business_name)) >= 2),
    description TEXT NOT NULL CHECK (char_length(btrim(description)) >= 20),
    business_type TEXT NOT NULL CHECK (
        business_type IN (
            'cakes',
            'photo_video',
            'catering',
            'hosting',
            'band_music',
            'coordinator',
            'styling_decor',
            'flowers',
            'lights_sounds',
            'venue',
            'rentals',
            'mobile_bar',
            'entertainment',
            'hair_makeup',
            'invites_souvenirs',
            'transportation',
            'other'
        )
    ),
    facebook_page_url TEXT,
    website_url TEXT,
    extra_link_url TEXT,
    image_bucket TEXT,
    image_path TEXT,
    image_url TEXT,
    source TEXT NOT NULL DEFAULT 'supplier-signup-page',
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cakegenie_supplier_signups_created_at
    ON public.cakegenie_supplier_signups (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cakegenie_supplier_signups_status_created
    ON public.cakegenie_supplier_signups (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cakegenie_supplier_signups_business_type
    ON public.cakegenie_supplier_signups (business_type);

ALTER TABLE public.cakegenie_supplier_signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cakegenie_supplier_signups FROM anon, authenticated;
GRANT INSERT ON public.cakegenie_supplier_signups TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cakegenie_supplier_signups TO service_role;

CREATE POLICY "Anyone can submit supplier signup applications"
    ON public.cakegenie_supplier_signups
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        status = 'new'
        AND source = 'supplier-signup-page'
        AND notes IS NULL
        AND metadata = '{}'::jsonb
    );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'supplier-signup-images',
    'supplier-signup-images',
    true,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Supplier signup images are publicly readable"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (
        bucket_id = 'supplier-signup-images'
        AND storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
    );

CREATE POLICY "Anyone can upload supplier signup images"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        bucket_id = 'supplier-signup-images'
    );

COMMENT ON TABLE public.cakegenie_supplier_signups IS
    'Inbound event supplier applications from /suppliers/signup. Contains public business links plus private submitter contact details.';

COMMENT ON COLUMN public.cakegenie_supplier_signups.business_type IS
    'Controlled event supplier category selected from the public supplier signup form.';
