-- Add price and keywords columns to cakegenie_analysis_cache
ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS price numeric,
ADD COLUMN IF NOT EXISTS keywords text;

COMMENT ON COLUMN public.cakegenie_analysis_cache.price IS 'Cached total price (lowest base price + addon price)';
COMMENT ON COLUMN public.cakegenie_analysis_cache.keywords IS 'Cached keywords from analysis result';
