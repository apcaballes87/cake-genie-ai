-- Keep fresh environments aligned with the live creator application schema.
ALTER TABLE public.creators
    ADD COLUMN IF NOT EXISTS content_niche TEXT NULL,
    ADD COLUMN IF NOT EXISTS best_video_url TEXT NULL;
