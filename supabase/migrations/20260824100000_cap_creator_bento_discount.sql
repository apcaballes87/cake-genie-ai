-- Newly created creator bento codes cover at most the regular PHP 499 bento
-- price. Existing codes are intentionally left unchanged.

CREATE OR REPLACE FUNCTION public.cap_creator_bento_discount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog, pg_temp
AS $function$
BEGIN
    IF NEW.code_purpose = 'creator_bento' THEN
        NEW.max_discount_amount := LEAST(COALESCE(NEW.max_discount_amount, 499), 499);
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS cap_creator_bento_discount_on_write
    ON public.discount_codes;

CREATE TRIGGER cap_creator_bento_discount_on_write
BEFORE INSERT
ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.cap_creator_bento_discount();
