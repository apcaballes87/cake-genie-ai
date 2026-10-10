ALTER TABLE public.cakegenie_orders
  ADD COLUMN IF NOT EXISTS buyer_first_touch_platform text,
  ADD COLUMN IF NOT EXISTS buyer_first_touch_confidence text,
  ADD COLUMN IF NOT EXISTS buyer_first_touch_landing_path text,
  ADD COLUMN IF NOT EXISTS buyer_purchase_session_platform text,
  ADD COLUMN IF NOT EXISTS buyer_purchase_session_confidence text;

CREATE OR REPLACE FUNCTION public.sync_buyer_attribution_derived_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  first_touch jsonb := COALESCE(NEW.buyer_attribution -> 'firstTouch', '{}'::jsonb);
  purchase_session jsonb := COALESCE(NEW.buyer_attribution -> 'purchaseSession', '{}'::jsonb);
  first_landing_path text;
BEGIN
  NEW.buyer_first_touch_platform := NULLIF(BTRIM(first_touch ->> 'platform'), '');
  NEW.buyer_first_touch_confidence := NULLIF(BTRIM(first_touch ->> 'confidence'), '');
  first_landing_path := NULLIF(BTRIM(first_touch ->> 'landingPagePath'), '');

  IF first_landing_path IS NULL THEN
    first_landing_path := NULLIF(BTRIM(SPLIT_PART(first_touch ->> 'landingPath', '?', 1)), '');
  END IF;

  IF first_landing_path IS NULL AND (first_touch ->> 'landingUrl') ~ '^https?://' THEN
    first_landing_path := NULLIF(
      BTRIM(SPLIT_PART(REGEXP_REPLACE(first_touch ->> 'landingUrl', '^https?://[^/]+', ''), '?', 1)),
      ''
    );
  END IF;

  IF first_landing_path IS NOT NULL AND LEFT(first_landing_path, 1) <> '/' THEN
    first_landing_path := '/' || first_landing_path;
  END IF;

  NEW.buyer_first_touch_landing_path := first_landing_path;
  NEW.buyer_purchase_session_platform := NULLIF(BTRIM(purchase_session ->> 'platform'), '');
  NEW.buyer_purchase_session_confidence := NULLIF(BTRIM(purchase_session ->> 'confidence'), '');

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_buyer_attribution_derived_fields_trigger
  ON public.cakegenie_orders;

CREATE TRIGGER sync_buyer_attribution_derived_fields_trigger
BEFORE INSERT OR UPDATE OF buyer_attribution
ON public.cakegenie_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_buyer_attribution_derived_fields();

UPDATE public.cakegenie_orders
SET
  buyer_first_touch_platform = COALESCE(
    NULLIF(BTRIM(buyer_attribution #>> '{firstTouch,platform}'), ''),
    CASE
      WHEN LOWER(COALESCE(buyer_attribution #>> '{firstTouch,source}', '')) = 'google'
        AND LOWER(COALESCE(buyer_attribution #>> '{firstTouch,medium}', '')) IN ('shopping', 'paid_shopping', 'shopping_ads') THEN 'google_shopping'
      WHEN buyer_attribution #>> '{firstTouch,clickIdType}' IN ('gclid', 'gbraid', 'wbraid') THEN 'google_unknown'
      WHEN buyer_attribution #>> '{firstTouch,clickIdType}' = 'fbclid' THEN 'meta_unknown'
      WHEN buyer_attribution #>> '{firstTouch,clickIdType}' = 'ttclid' THEN 'tiktok'
      WHEN buyer_attribution #>> '{firstTouch,category}' = 'direct'
        AND buyer_attribution #>> '{firstTouch,source}' = '(direct)' THEN 'direct'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{firstTouch,source}', '')) LIKE 'google%' THEN 'google'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{firstTouch,source}', '')) IN ('facebook', 'facebook.com') THEN 'facebook'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{firstTouch,source}', '')) IN ('instagram', 'instagram.com') THEN 'instagram'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{firstTouch,source}', '')) IN ('tiktok', 'tiktok.com') THEN 'tiktok'
      WHEN NULLIF(BTRIM(buyer_attribution #>> '{firstTouch,entrySource}'), '') IS NOT NULL
        OR buyer_attribution #>> '{firstTouch,medium}' = 'internal_handoff' THEN 'internal'
      WHEN buyer_attribution #>> '{firstTouch,category}' = 'referral' THEN 'referral'
      ELSE 'unknown'
    END
  ),
  buyer_first_touch_confidence = COALESCE(
    NULLIF(BTRIM(buyer_attribution #>> '{firstTouch,confidence}'), ''),
    CASE
      WHEN LOWER(COALESCE(buyer_attribution #>> '{firstTouch,source}', '')) = 'google'
        AND LOWER(COALESCE(buyer_attribution #>> '{firstTouch,medium}', '')) IN ('shopping', 'paid_shopping', 'shopping_ads') THEN 'explicit_utm'
      WHEN buyer_attribution #>> '{firstTouch,clickIdType}' IS NOT NULL THEN 'click_id'
      WHEN buyer_attribution #>> '{firstTouch,category}' = 'direct'
        AND buyer_attribution #>> '{firstTouch,source}' = '(direct)' THEN 'direct'
      WHEN NULLIF(BTRIM(buyer_attribution #>> '{firstTouch,entrySource}'), '') IS NOT NULL
        OR buyer_attribution #>> '{firstTouch,medium}' = 'internal_handoff' THEN 'internal'
      WHEN buyer_attribution #>> '{firstTouch,category}' = 'referral' THEN 'referrer'
      WHEN NULLIF(BTRIM(buyer_attribution #>> '{firstTouch,source}'), '') IS NOT NULL THEN 'explicit_utm'
      ELSE 'unknown'
    END
  ),
  buyer_first_touch_landing_path = COALESCE(
    NULLIF(BTRIM(buyer_attribution #>> '{firstTouch,landingPagePath}'), ''),
    NULLIF(BTRIM(SPLIT_PART(buyer_attribution #>> '{firstTouch,landingPath}', '?', 1)), ''),
    NULLIF(
      BTRIM(SPLIT_PART(REGEXP_REPLACE(buyer_attribution #>> '{firstTouch,landingUrl}', '^https?://[^/]+', ''), '?', 1)),
      ''
    )
  ),
  buyer_purchase_session_platform = COALESCE(
    NULLIF(BTRIM(buyer_attribution #>> '{purchaseSession,platform}'), ''),
    CASE
      WHEN LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,source}', '')) = 'google'
        AND LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,medium}', '')) IN ('shopping', 'paid_shopping', 'shopping_ads') THEN 'google_shopping'
      WHEN buyer_attribution #>> '{purchaseSession,clickIdType}' IN ('gclid', 'gbraid', 'wbraid') THEN 'google_unknown'
      WHEN buyer_attribution #>> '{purchaseSession,clickIdType}' = 'fbclid' THEN 'meta_unknown'
      WHEN buyer_attribution #>> '{purchaseSession,clickIdType}' = 'ttclid' THEN 'tiktok'
      WHEN buyer_attribution #>> '{purchaseSession,category}' = 'direct'
        AND buyer_attribution #>> '{purchaseSession,source}' = '(direct)' THEN 'direct'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,source}', '')) LIKE 'google%' THEN 'google'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,source}', '')) IN ('facebook', 'facebook.com') THEN 'facebook'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,source}', '')) IN ('instagram', 'instagram.com') THEN 'instagram'
      WHEN LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,source}', '')) IN ('tiktok', 'tiktok.com') THEN 'tiktok'
      WHEN NULLIF(BTRIM(buyer_attribution #>> '{purchaseSession,entrySource}'), '') IS NOT NULL
        OR buyer_attribution #>> '{purchaseSession,medium}' = 'internal_handoff' THEN 'internal'
      WHEN buyer_attribution #>> '{purchaseSession,category}' = 'referral' THEN 'referral'
      ELSE 'unknown'
    END
  ),
  buyer_purchase_session_confidence = COALESCE(
    NULLIF(BTRIM(buyer_attribution #>> '{purchaseSession,confidence}'), ''),
    CASE
      WHEN LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,source}', '')) = 'google'
        AND LOWER(COALESCE(buyer_attribution #>> '{purchaseSession,medium}', '')) IN ('shopping', 'paid_shopping', 'shopping_ads') THEN 'explicit_utm'
      WHEN buyer_attribution #>> '{purchaseSession,clickIdType}' IS NOT NULL THEN 'click_id'
      WHEN buyer_attribution #>> '{purchaseSession,category}' = 'direct'
        AND buyer_attribution #>> '{purchaseSession,source}' = '(direct)' THEN 'direct'
      WHEN NULLIF(BTRIM(buyer_attribution #>> '{purchaseSession,entrySource}'), '') IS NOT NULL
        OR buyer_attribution #>> '{purchaseSession,medium}' = 'internal_handoff' THEN 'internal'
      WHEN buyer_attribution #>> '{purchaseSession,category}' = 'referral' THEN 'referrer'
      WHEN NULLIF(BTRIM(buyer_attribution #>> '{purchaseSession,source}'), '') IS NOT NULL THEN 'explicit_utm'
      ELSE 'unknown'
    END
  )
WHERE COALESCE(buyer_attribution, '{}'::jsonb) <> '{}'::jsonb;

COMMENT ON COLUMN public.cakegenie_orders.buyer_first_touch_platform IS
  'Normalized first-touch acquisition platform, including explicit unknown families.';
COMMENT ON COLUMN public.cakegenie_orders.buyer_first_touch_landing_path IS
  'Sanitized pathname captured on the first attribution touch; query parameters are excluded.';
COMMENT ON COLUMN public.cakegenie_orders.buyer_purchase_session_platform IS
  'Normalized acquisition platform for the session that led to checkout.';
