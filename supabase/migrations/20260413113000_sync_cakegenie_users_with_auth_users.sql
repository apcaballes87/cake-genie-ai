-- Keep public.cakegenie_users in sync with Supabase Auth users.
-- Standard flow:
-- - guest carts stay anonymous and use session_id
-- - authenticated users always get a matching profile row
--
-- This migration also repairs legacy rows where the same email exists in
-- cakegenie_users under a different user_id than auth.users.id.

CREATE OR REPLACE FUNCTION public.repoint_cakegenie_user_references(
    p_old_user_id UUID,
    p_new_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    ref RECORD;
BEGIN
    IF p_old_user_id IS NULL OR p_new_user_id IS NULL OR p_old_user_id = p_new_user_id THEN
        RETURN;
    END IF;

    FOR ref IN
        SELECT
            ns.nspname AS schema_name,
            cls.relname AS table_name,
            att.attname AS column_name
        FROM pg_constraint con
        JOIN pg_class cls
            ON cls.oid = con.conrelid
        JOIN pg_namespace ns
            ON ns.oid = cls.relnamespace
        JOIN unnest(con.conkey) AS key_col(attnum)
            ON true
        JOIN pg_attribute att
            ON att.attrelid = cls.oid
           AND att.attnum = key_col.attnum
        WHERE con.contype = 'f'
          AND con.confrelid = 'public.cakegenie_users'::regclass
          AND array_length(con.conkey, 1) = 1
          AND ns.nspname = 'public'
          AND cls.relname <> 'cakegenie_users'
    LOOP
        EXECUTE format(
            'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
            ref.schema_name,
            ref.table_name,
            ref.column_name,
            ref.column_name
        )
        USING p_new_user_id, p_old_user_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_cakegenie_user_from_auth_user(
    p_auth_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_auth_user auth.users%ROWTYPE;
    v_legacy_user public.cakegenie_users%ROWTYPE;
BEGIN
    SELECT *
    INTO v_auth_user
    FROM auth.users
    WHERE id = p_auth_user_id;

    IF NOT FOUND OR v_auth_user.email IS NULL THEN
        RETURN;
    END IF;

    SELECT *
    INTO v_legacy_user
    FROM public.cakegenie_users
    WHERE lower(email) = lower(v_auth_user.email)
      AND user_id <> v_auth_user.id
    LIMIT 1;

    IF FOUND THEN
        -- Free the unique email constraint so the canonical auth-linked row
        -- can be created before we repoint foreign keys to it.
        UPDATE public.cakegenie_users
        SET
            email = format(
                'legacy+%s__%s',
                replace(v_legacy_user.user_id::text, '-', ''),
                v_legacy_user.email
            ),
            updated_at = timezone('utc'::text, now())
        WHERE user_id = v_legacy_user.user_id;
    END IF;

    INSERT INTO public.cakegenie_users (
        user_id,
        email,
        first_name,
        last_name,
        phone_number,
        email_verified,
        is_active,
        created_at,
        updated_at,
        last_login
    )
    VALUES (
        v_auth_user.id,
        v_auth_user.email,
        COALESCE(
            NULLIF(v_auth_user.raw_user_meta_data ->> 'first_name', ''),
            v_legacy_user.first_name
        ),
        COALESCE(
            NULLIF(v_auth_user.raw_user_meta_data ->> 'last_name', ''),
            v_legacy_user.last_name
        ),
        v_legacy_user.phone_number,
        v_auth_user.email_confirmed_at IS NOT NULL,
        true,
        COALESCE(v_auth_user.created_at, timezone('utc'::text, now())),
        timezone('utc'::text, now()),
        v_auth_user.last_sign_in_at
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, cakegenie_users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, cakegenie_users.last_name),
        phone_number = COALESCE(EXCLUDED.phone_number, cakegenie_users.phone_number),
        email_verified = EXCLUDED.email_verified,
        is_active = true,
        updated_at = timezone('utc'::text, now()),
        last_login = COALESCE(EXCLUDED.last_login, cakegenie_users.last_login);

    IF v_legacy_user.user_id IS NOT NULL AND v_legacy_user.user_id <> v_auth_user.id THEN
        PERFORM public.repoint_cakegenie_user_references(v_legacy_user.user_id, v_auth_user.id);

        DELETE FROM public.cakegenie_users
        WHERE user_id = v_legacy_user.user_id;
    END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_cakegenie_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.sync_cakegenie_user_from_auth_user(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS sync_cakegenie_user_from_auth_trigger ON auth.users;

CREATE TRIGGER sync_cakegenie_user_from_auth_trigger
    AFTER INSERT OR UPDATE OF email, raw_user_meta_data, email_confirmed_at, last_sign_in_at
    ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_cakegenie_user_from_auth();

DO $$
DECLARE
    v_auth_user RECORD;
BEGIN
    FOR v_auth_user IN
        SELECT id
        FROM auth.users
        WHERE email IS NOT NULL
    LOOP
        PERFORM public.sync_cakegenie_user_from_auth_user(v_auth_user.id);
    END LOOP;
END;
$$;
