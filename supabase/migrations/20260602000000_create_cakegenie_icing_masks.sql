-- Create the cakegenie_icing_masks table
-- Stores the Gemini-generated icing mask (icing rendered solid red, everything else
-- pitch-black) once per cake design. The mask is keyed to a cakegenie_analysis_cache
-- row via cache_id and reused for unlimited instant client-side HSL recolors.
-- Mirrors the structure and RLS conventions of public.cakegenie_color_variants, but
-- holds one row per design (color-independent) rather than one row per color.
CREATE TABLE IF NOT EXISTS public.cakegenie_icing_masks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_id         UUID NOT NULL
                     REFERENCES public.cakegenie_analysis_cache (id) ON DELETE CASCADE,
    mask_url         TEXT NOT NULL,                 -- Supabase Storage public URL of the red/black mask PNG
    source_image_url TEXT,                          -- base image the mask was generated from (provenance)
    mask_version     SMALLINT NOT NULL DEFAULT 1,   -- bump if ICING_CONVERSION_PROMPT semantics change
    width            INTEGER,                       -- mask pixel width (for compositing sanity checks)
    height           INTEGER,                       -- mask pixel height
    status           TEXT NOT NULL DEFAULT 'ready', -- 'ready' | 'failed'
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One canonical mask per design per prompt version. Makes the persistence insert
    -- idempotent (safe against concurrent first-clicks via ON CONFLICT DO NOTHING).
    CONSTRAINT cakegenie_icing_masks_cache_version_uniq UNIQUE (cache_id, mask_version)
);

-- Fast lookup of a design's mask by cache_id.
CREATE INDEX IF NOT EXISTS idx_cakegenie_icing_masks_cache_id
    ON public.cakegenie_icing_masks (cache_id);

-- RLS Policies (mirror public.cakegenie_color_variants)
ALTER TABLE public.cakegenie_icing_masks ENABLE ROW LEVEL SECURITY;

-- Allow public read access (masks are shared across all users of a design).
DROP POLICY IF EXISTS "Allow public read access" ON public.cakegenie_icing_masks;
CREATE POLICY "Allow public read access"
    ON public.cakegenie_icing_masks
    FOR SELECT
    USING (true);

-- Allow anonymous or authenticated insert (first-click generation persists the mask).
DROP POLICY IF EXISTS "Allow anonymous or authenticated insert" ON public.cakegenie_icing_masks;
CREATE POLICY "Allow anonymous or authenticated insert"
    ON public.cakegenie_icing_masks
    FOR INSERT
    WITH CHECK (true);
