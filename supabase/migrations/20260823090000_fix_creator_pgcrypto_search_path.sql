-- The creator RPC is SECURITY DEFINER and its locked search_path previously
-- excluded the Supabase extensions schema. pgcrypto was installed in
-- extensions, so code generation failed at runtime with 42883 when the RPC
-- reached gen_random_bytes().

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER FUNCTION public.submit_creator_application(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN
)
SET search_path = public, extensions, pg_catalog, pg_temp;
