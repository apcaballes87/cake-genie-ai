# ChatGPT Ads for Genie.ph

This integration exports the published Genie.ph cake-design catalog to an OpenAI Ads product feed and reports eligible paid orders. It does not create campaigns or change campaign budgets.

## Before enabling catalog uploads

Confirm with the advertiser account that Product Feeds API access is enabled and that the Philippines market and PHP prices are accepted. OpenAI documents account-level feed access as a prerequisite; the availability of Ads Manager by itself does not confirm feed access.

In Ads Manager / the Advertiser API:

1. Create a product feed for the Philippines and save its feed ID.
2. Create an ad-account-scoped Advertiser API key. The Ads Manager key dialog describes Ads Management API access and does not offer a feed-only permission scope; keep the key server-side and use it only for feed operations in this integration.
3. Configure SFTP password or SSH-key access and save the returned connection URI and matching credential.
4. Create the Measurement Pixel and Conversions API key if server-side order reporting is wanted.

## Vercel configuration

Set these in the linked Vercel project's **Production** environment after the account checks above. Keep the advertiser and SFTP credentials server-only. `NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID` is intentionally public because the browser Pixel reads it; it is an identifier, not an API secret. Avoid copying production credentials into Preview or Development unless you deliberately want those deployments to send real events or upload feeds.

- `OPENAI_ADS_CATALOG_SYNC_ENABLED=false` while provisioning; change to `true` to activate the daily upload.
- `OPENAI_ADS_API_KEY`
- `OPENAI_ADS_FEED_ID`
- `OPENAI_ADS_SFTP_URI`
- `OPENAI_ADS_SFTP_USERNAME` if the URI does not contain the username
- Either `OPENAI_ADS_SFTP_PASSWORD` or `OPENAI_ADS_SFTP_PRIVATE_KEY`; set the private-key passphrase only when required.
- `NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID` for the browser Pixel. Do not set this until the storefront has an explicit measurement-consent path. The Pixel defaults consent to `true`; when consent is required, call `oaiq("consent", false)` before initialization, then set it to `true` only after the visitor opts in.

The protected `/api/openai-ads/cron` endpoint uses the existing `CRON_SECRET`. It uploads a full `catalog.csv` snapshot once per day, then polls briefly for that upload's status. Its response reports eligible product count and accepted/rejected row counts and diagnostics when OpenAI has finished processing; if processing is still underway, it returns the latest pending status. Keep the sync disabled until the feed credentials and market support are confirmed.

## Supabase Edge Function secrets

For the Xendit webhook, payment verification, and free-order path, set:

- `OPENAI_ADS_PIXEL_ID`
- `OPENAI_ADS_CONVERSIONS_API_KEY`

These are separate from the browser-visible Pixel ID variable. The CAPI event contains the order ID for deduplication, order amount, and feed-matched product slugs. It does not include email, phone, name, user ID, or address. Missing credentials and OpenAI request failures do not fail payment processing.

Deploy the updated `xendit-webhook`, `verify-xendit-payment`, and `create-xendit-payment` function code to the Supabase project that already handles Genie.ph payments. Supabase makes newly set Edge Function secrets available immediately, without a redeploy. After changing Vercel variables, redeploy the Next.js project so its server and browser configuration is refreshed; keep the feed flag `false` until that deployment and the account checks are complete. Initialize the Pixel's consent control before the Pixel itself when the storefront requires consent.

## Feed and measurement behavior

- Catalog rows come only from published `cakegenie_analysis_cache` designs with a public HTTPS Studio-edited image and a positive price resolved with the same price-option ordering and alignment as the product page.
- Product IDs are stable design slugs. Events use those same IDs from the cart/order commerce snapshot.
- Availability maps to OpenAI's supported values. Missing or unrecognized source availability is sent as `unknown`.
- `is_ads_eligible=true`; product search and ChatGPT checkout eligibility remain `false`.
- The feed uploader skips an empty catalog instead of uploading a snapshot that could remove all existing items.
- `OAI-AdsBot` can crawl product pages, and the existing `OAI-SearchBot` access remains enabled.

When a campaign is created separately, add campaign-level landing-page UTMs such as `utm_source=chatgpt`, `utm_medium=paid`, and the campaign name. Product-feed campaigns target countries, so a Philippines campaign cannot be restricted to Cebu alone.
