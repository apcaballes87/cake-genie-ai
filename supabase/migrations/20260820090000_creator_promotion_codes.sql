-- Creator applications own three discount codes:
-- 1. A public 10% referral code chosen by the creator.
-- 2. A private, email-bound free-bento code.
-- 3. A private, email-bound 50% voucher capped at PHP 1,500.

-- Supabase installs pgcrypto in the extensions schema. Keep it explicit because
-- the SECURITY DEFINER RPC below uses a locked search_path.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.discount_codes
    ADD COLUMN IF NOT EXISTS creator_id UUID NULL,
    ADD COLUMN IF NOT EXISTS code_purpose TEXT NULL,
    ADD COLUMN IF NOT EXISTS eligible_email TEXT NULL;

ALTER TABLE public.discount_codes
    DROP CONSTRAINT IF EXISTS discount_codes_code_purpose_check;

ALTER TABLE public.discount_codes
    ADD CONSTRAINT discount_codes_code_purpose_check
    CHECK (
        code_purpose IS NULL OR
        code_purpose IN ('creator_referral', 'creator_bento', 'creator_voucher')
    );

CREATE INDEX IF NOT EXISTS idx_discount_codes_creator_id
    ON public.discount_codes (creator_id)
    WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discount_codes_eligible_email
    ON public.discount_codes (lower(eligible_email))
    WHERE eligible_email IS NOT NULL;

-- All application codes are normalized to uppercase in the application RPC.
-- These indexes also protect against case-only collisions from older writers.
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_upper_key
    ON public.discount_codes (upper(code));

CREATE UNIQUE INDEX IF NOT EXISTS creators_promo_code_upper_key
    ON public.creators (upper(promo_code));

ALTER TABLE public.discount_codes
    DROP CONSTRAINT IF EXISTS discount_codes_creator_id_fkey;

ALTER TABLE public.discount_codes
    ADD CONSTRAINT discount_codes_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE SET NULL;

-- Creator submissions now go through the server-side RPC so clients cannot
-- forge status, consent, or discount-code ownership fields directly.
DROP POLICY IF EXISTS "Allow public insert to creators" ON public.creators;

CREATE OR REPLACE FUNCTION public.submit_creator_application(
    p_name TEXT,
    p_email TEXT,
    p_contact_number TEXT,
    p_address TEXT,
    p_content_niche TEXT,
    p_tiktok_handle TEXT DEFAULT NULL,
    p_tiktok_followers INTEGER DEFAULT NULL,
    p_instagram_handle TEXT DEFAULT NULL,
    p_instagram_followers INTEGER DEFAULT NULL,
    p_facebook_handle TEXT DEFAULT NULL,
    p_facebook_followers INTEGER DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_agreed_to_terms BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    creator_id UUID,
    referral_code TEXT,
    bento_code TEXT,
    voucher_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $function$
DECLARE
    v_creator_id UUID;
    v_referral_code_id UUID;
    v_bento_code_id UUID;
    v_voucher_code_id UUID;
    v_referral_code TEXT := regexp_replace(upper(trim(COALESCE(p_promo_code, ''))), '[^A-Z0-9]', '', 'g');
    v_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_bento_code TEXT;
    v_voucher_code TEXT;
    v_bento_created BOOLEAN;
    v_voucher_created BOOLEAN;
BEGIN
    IF NULLIF(trim(COALESCE(p_name, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_email, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_contact_number, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_address, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(p_content_niche, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Please fill in all required application details.'
            USING ERRCODE = '22023';
    END IF;

    IF p_agreed_to_terms IS NOT TRUE THEN
        RAISE EXCEPTION 'You must agree to the creator collaboration terms.'
            USING ERRCODE = '22023';
    END IF;

    IF NULLIF(trim(COALESCE(p_tiktok_handle, '')), '') IS NULL
       AND NULLIF(trim(COALESCE(p_instagram_handle, '')), '') IS NULL
       AND NULLIF(trim(COALESCE(p_facebook_handle, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Please provide at least one social media handle.'
            USING ERRCODE = '22023';
    END IF;

    IF length(v_referral_code) < 4 OR length(v_referral_code) > 24 THEN
        RAISE EXCEPTION 'Your custom promo code must be 4 to 24 letters or numbers.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.creators
        WHERE upper(promo_code) = v_referral_code
    ) OR EXISTS (
        SELECT 1
        FROM public.discount_codes
        WHERE upper(code) = v_referral_code
    ) THEN
        RAISE EXCEPTION 'CREATOR_PROMO_CODE_TAKEN'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.creators (
        name,
        email,
        contact_number,
        address,
        content_niche,
        tiktok_handle,
        tiktok_followers,
        instagram_handle,
        instagram_followers,
        facebook_handle,
        facebook_followers,
        promo_code,
        agreed_to_terms,
        status
    )
    VALUES (
        trim(p_name),
        v_email,
        trim(p_contact_number),
        trim(p_address),
        trim(p_content_niche),
        NULLIF(trim(p_tiktok_handle), ''),
        p_tiktok_followers,
        NULLIF(trim(p_instagram_handle), ''),
        p_instagram_followers,
        NULLIF(trim(p_facebook_handle), ''),
        p_facebook_followers,
        v_referral_code,
        TRUE,
        'pending'
    )
    RETURNING id INTO v_creator_id;

    BEGIN
        INSERT INTO public.discount_codes (
            creator_id,
            code,
            code_purpose,
            discount_percentage,
            max_uses,
            times_used,
            public_code,
            is_active,
            free_delivery,
            one_per_user,
            new_users_only,
            reason
        )
        VALUES (
            v_creator_id,
            v_referral_code,
            'creator_referral',
            10,
            NULL,
            0,
            TRUE,
            TRUE,
            FALSE,
            FALSE,
            FALSE,
            'Creator referral code'
        )
        RETURNING code_id INTO v_referral_code_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'CREATOR_PROMO_CODE_TAKEN'
            USING ERRCODE = '23505';
    END;

    v_bento_created := FALSE;
    FOR attempt IN 1..12 LOOP
        v_bento_code := 'GENIEBENTO' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
        BEGIN
            INSERT INTO public.discount_codes (
                creator_id,
                code,
                code_purpose,
                eligible_email,
                discount_percentage,
                max_uses,
                times_used,
                public_code,
                is_active,
                free_delivery,
                one_per_user,
                new_users_only,
                applies_to_cake_types,
                reason
            )
            VALUES (
                v_creator_id,
                v_bento_code,
                'creator_bento',
                v_email,
                100,
                1,
                0,
                FALSE,
                TRUE,
                FALSE,
                FALSE,
                FALSE,
                ARRAY['Bento']::TEXT[],
                'Creator complimentary bento cake'
            )
            RETURNING code_id INTO v_bento_code_id;
            v_bento_created := TRUE;
        EXCEPTION WHEN unique_violation THEN
            v_bento_created := FALSE;
        END;
        EXIT WHEN v_bento_created;
    END LOOP;

    IF NOT v_bento_created THEN
        RAISE EXCEPTION 'Could not generate a unique free-bento code.'
            USING ERRCODE = 'unique_violation';
    END IF;

    v_voucher_created := FALSE;
    FOR attempt IN 1..12 LOOP
        v_voucher_code := 'GENIE50' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
        BEGIN
            INSERT INTO public.discount_codes (
                creator_id,
                code,
                code_purpose,
                eligible_email,
                discount_percentage,
                max_discount_amount,
                max_uses,
                times_used,
                public_code,
                is_active,
                free_delivery,
                one_per_user,
                new_users_only,
                reason
            )
            VALUES (
                v_creator_id,
                v_voucher_code,
                'creator_voucher',
                v_email,
                50,
                1500,
                1,
                0,
                FALSE,
                FALSE,
                FALSE,
                FALSE,
                FALSE,
                'Creator 50% personal voucher'
            )
            RETURNING code_id INTO v_voucher_code_id;
            v_voucher_created := TRUE;
        EXCEPTION WHEN unique_violation THEN
            v_voucher_created := FALSE;
        END;
        EXIT WHEN v_voucher_created;
    END LOOP;

    IF NOT v_voucher_created THEN
        RAISE EXCEPTION 'Could not generate a unique personal voucher code.'
            USING ERRCODE = 'unique_violation';
    END IF;

    RETURN QUERY
    SELECT v_creator_id, v_referral_code, v_bento_code, v_voucher_code;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_creator_application(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_creator_application(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN
) TO service_role;

COMMENT ON FUNCTION public.submit_creator_application(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, INTEGER, TEXT, BOOLEAN
) IS 'Atomically creates a creator application and its referral, free-bento, and personal voucher codes.';
