# Admin dashboard prompt: show order discounts and attribution

Work in `/Users/apcaballes/genie.ph-admin-dashboard` and update the existing Orders page only. Do not modify the storefront repository, database schema, checkout RPC signatures, payment behavior, or attribution classification.

## Goal

Make each order row and the order-details modal show:

- The discount code actually applied, if any.
- The recorded discount amount.
- The normalized first-touch acquisition source.
- First-touch confidence.
- The sanitized first landing-page path.
- The purchase-session source and confidence when available.

## Existing admin seams

- `pages/OrdersPage.tsx` renders the desktop table, mobile cards, payment summary, and customer/order details modal.
- `services/supabase.ts:getOrders()` currently reads `cakegenie_orders` with `select('*')` and enriches customer information.
- `services/supabase.ts:getOrderDetails()` currently reads one order with `select('*')` and separately loads items, contributions, and address information.
- `types.ts:Order` is the admin order model and needs the new optional fields.
- Preserve the existing Orders filters, pagination, status controls, payment controls, split-order behavior, and visual style.

## Stored database fields

The live `cakegenie_orders` table contains:

### Discount fields

- `discount_code_id` — durable foreign key to `discount_codes.code_id`.
- `discount_amount` — amount deducted from the order.
- `discount_code_text` — legacy snapshot field; it is currently empty on live orders, so do not rely on it alone.
- Resolve the display label from `discount_codes.code` using the `discount_code_id` relationship, with `discount_code_text` as a fallback if the relationship is unavailable. If both are empty, display `No code`.

### Attribution fields

- `buyer_first_touch_source` — legacy source value.
- `buyer_first_touch_platform` — normalized first-touch platform: `direct`, `google`, `google_shopping`, `google_unknown`, `facebook`, `instagram`, `meta_unknown`, `tiktok`, `internal`, `referral`, or `unknown`.
- `buyer_first_touch_confidence` — `explicit_utm`, `click_id`, `referrer`, `internal`, `direct`, or `unknown`.
- `buyer_first_touch_landing_path` — sanitized pathname only, such as `/search` or `/collections/bento-cake`.
- `buyer_purchase_session_source` — legacy purchase-session source.
- `buyer_purchase_session_platform` — normalized platform for the checkout session.
- `buyer_purchase_session_confidence` — confidence for the checkout-session platform.

Do not display `buyer_attribution` JSON, click IDs, raw landing URLs, query strings, or image URLs.

## Implementation requirements

1. Extend `types.ts:Order` with the stored discount and attribution fields as nullable/optional fields, without weakening the existing order types.

2. Resolve discount-code labels in the service layer. Prefer a Supabase relationship query if the actual live foreign-key relationship is available; otherwise fetch the distinct `discount_code_id` values for the current page/details request from `discount_codes` and attach a display-only `discount_code` field. Do not issue one query per table row.

3. Add a small display helper in `OrdersPage.tsx` or a nearby utility:

   - `discountCode = resolved discount_codes.code ?? order.discount_code_text ?? 'No code'`
   - `source = order.buyer_first_touch_platform ?? order.buyer_first_touch_source ?? 'unknown'`
   - `confidence = order.buyer_first_touch_confidence ?? 'unknown'`
   - `landingPage = order.buyer_first_touch_landing_path ?? 'Unknown'`
   - `purchaseSession = order.buyer_purchase_session_platform ?? order.buyer_purchase_session_source ?? 'unknown'`

   Render platform labels in readable title case while preserving explicit states such as `Google Unknown` and `Meta Unknown`. Do not guess an exact platform when the stored value is unknown.

4. In the desktop Orders table, add compact columns for `Discount`, `Source`, and `First landing page`. Keep the existing horizontal overflow behavior and make long paths truncate with the full path available via an accessible `title` or equivalent.

5. In the mobile order card, add compact labeled lines or badges for the discount code, acquisition source, and first landing page. Do not make the card excessively tall; preserve the current status/payment badges.

6. In the order-details modal, add an `Attribution & Promotion` section near the Payment Summary or Customer Information showing:

   - Discount code
   - Discount amount
   - Acquisition source
   - Confidence
   - First landing page
   - Purchase-session source, with confidence when present

   Use the existing `InfoRow`, currency formatter, border, typography, spacing, and responsive layout conventions.

7. Missing historical attribution must render as `Unknown`; missing discount code must render as `No code`. Do not infer a source from `order.source`, `gclid`, `fbclid`, or URL data in the admin dashboard.

8. Add focused regression coverage for:

   - A Google Shopping order with `/collections/bento-cake`.
   - An ambiguous `meta_unknown` order.
   - A direct order with no discount code.
   - A discount order where `discount_code_text` is empty but `discount_code_id` resolves through `discount_codes.code`.
   - A missing-attribution order rendering `Unknown` without throwing.

9. Verify the admin project with `npm run lint` and `npm run build`. If browser verification is available, check the populated Orders page at desktop and mobile widths, open an order with a discount and attribution, and confirm there are no layout overflows or raw query/click-ID values exposed.

Preserve unrelated existing worktree changes. Do not create a new migration: these fields and the attribution trigger already exist in the live Supabase project.
