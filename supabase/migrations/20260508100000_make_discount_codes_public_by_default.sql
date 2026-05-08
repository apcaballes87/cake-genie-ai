-- Ensure all discount codes are publicly readable/usable by default.
-- Backfill any existing rows that were created with public_code = false
-- and make future inserts default to true unless a caller explicitly opts out.

UPDATE public.discount_codes
SET public_code = true
WHERE public_code IS DISTINCT FROM true;

ALTER TABLE public.discount_codes
ALTER COLUMN public_code SET DEFAULT true;
