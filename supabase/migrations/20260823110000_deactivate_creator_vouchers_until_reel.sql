-- Personal creator vouchers are issued before the creator submits a video reel.
-- Keep them inactive until the creator-submission workflow activates them.

CREATE OR REPLACE FUNCTION public.keep_creator_vouchers_inactive_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $function$
BEGIN
    IF NEW.code_purpose = 'creator_voucher' THEN
        NEW.is_active := FALSE;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS keep_creator_vouchers_inactive_on_insert_trigger
    ON public.discount_codes;

CREATE TRIGGER keep_creator_vouchers_inactive_on_insert_trigger
    BEFORE INSERT ON public.discount_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.keep_creator_vouchers_inactive_on_insert();

-- Existing personal vouchers must also wait for video-reel submission.
UPDATE public.discount_codes
SET is_active = FALSE
WHERE code_purpose = 'creator_voucher'
  AND is_active IS TRUE;
