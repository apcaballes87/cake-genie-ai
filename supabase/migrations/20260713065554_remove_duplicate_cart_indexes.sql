-- Keep the canonical idx_cakegenie_* cart indexes and remove only the
-- byte-for-byte duplicate legacy indexes reported by Supabase advisors.
DROP INDEX IF EXISTS public.idx_cart_expires_at;
DROP INDEX IF EXISTS public.idx_cart_merchant;
DROP INDEX IF EXISTS public.idx_cart_session_id;
DROP INDEX IF EXISTS public.idx_cart_user_id;
