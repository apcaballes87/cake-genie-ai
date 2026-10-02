# Cloudflare Container migration runbook

This branch prepares one Next.js Node server in a Cloudflare Container, behind
one Worker. It does **not** switch traffic or enable scheduled jobs. Keep Vercel
serving production until every staging gate below passes.

## Baseline and prerequisites

- Source baseline: `origin/main` at `76b3d44f`, confirmed as Vercel's latest
  READY production commit on 2026-10-02. Recheck the live deployment commit
  before comparing requests. The separate primary checkout has unrelated
  changes and must not be used as the release source.
- Record current Vercel response status, redirect, cache headers, cookies, and
  body hashes for the homepage, representative product/ISR pages, robots and
  sitemaps, and safe API probes immediately before staging comparison. Keep
  authenticated/payment test fixtures private. Do not replay real webhooks.
- Verify Workers Paid/Containers is enabled and Docker is available with a
  Linux/amd64 builder. The image has not been runtime-tested without Docker.
- Cloudflare `genie.ph` is pending delegation. Reconcile imported apex and
  `www` DNS against authoritative records before changing nameservers; also
  check MX, SPF, DKIM, DMARC, CAA, and other TXT records.

## Build and stage

From this branch, provide only the public `NEXT_PUBLIC_*` values used by the
existing deployment. The optional input file is read locally and the generated
Wrangler config is ignored by Git; inspect it before deployment. Never pass a
private `.env` file to Docker or copy it into the image.
Set `NEXT_PUBLIC_SITE_URL` explicitly to the staging Worker's HTTPS
`workers.dev` origin before generating the staging config. The generator rejects
the live domain for staging; auth and image-studio links use this build-time
value. Check Supabase redirect allowlisting before testing auth callbacks.

```sh
node scripts/prepare-cloudflare-config.mjs staging /path/to/public-env-file
npm ci
npm run cf:typecheck
npx wrangler deploy --dry-run --containers-rollout=none --env="" -c wrangler.staging.generated.jsonc
npx wrangler deploy --env="" -c wrangler.staging.generated.jsonc
```

Staging uses a `workers.dev` hostname, one `basic` instance, a two-hour idle
timeout, and **no automatic crons or custom-domain routes**. A first deploy
requires the Cloudflare account to accept the Container image. It may take
time to start; do not infer runtime parity from a READY deployment alone.
Wrangler may print public `vars` values during dry-run or deploy; do not put
private values in those fields.

Supply only required runtime values through Cloudflare Worker secrets (the
Container class explicitly forwards allowlisted names). Configure them for
staging and production separately. Key names to reconcile with Vercel:

- Core: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`,
  `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`.
- Google: `VERTEX_AI_PROJECT`, `VERTEX_AI_LOCATION`,
  `VERTEX_AI_BATCH_GCS_URI`, `GOOGLE_CREDENTIALS_JSON`. Create a dedicated,
  least-privilege service-account JSON key for Cloudflare. Do not reuse the
  Vercel OIDC external-account JSON, and do not store the key in Wrangler
  config, the image, source control, or logs. Grant only the Vertex/GCS access
  that staging tests prove necessary.
- Add the optional service/provider values from `cloudflare/runtime-config.ts`
  only for features actually enabled in production (N8N, Pinterest, DataForSEO,
  Typesense, SEO batch, Roboflow, etc.). Public `NEXT_PUBLIC_*` values are
  baked into the client build, so changing one requires rebuilding the image.

Use `wrangler secret put NAME -c wrangler.staging.generated.jsonc` for staging
and add `--env production` for production. Secret commands may publish a new
Worker version; confirm that no production routes or crons are active first.
Never paste secret values into shell arguments or this document. Verify that
the built image and logs contain no private credential material.

## Staging parity gate

Compare the temporary Cloudflare URL with current Vercel. Use test accounts,
test payment events, and disposable uploads. Mark each item pass/fail with
response evidence before production routing:

1. Public and ISR pages, metadata/sitemaps, `www` to apex redirect, cache
   headers, `Set-Cookie`, and streaming responses.
2. Login/session, cart, checkout, payment callback/webhook signatures and raw
   body handling, rate limits, and request IP/country behavior.
3. Image upload/variants, **byte-for-byte or algorithm-exact Sharp and PDQ
   fingerprints** on fixed fixtures, cache lookup, and restart regeneration.
4. Vertex inference, GCS read/write, Studio editing, and long-running routes.
5. Each private cron route with the same bearer authentication but no active
   scheduler. Check side effects safely; never trigger a real production job
   just to test it.
6. Cold start after two-hour sleep, concurrent requests, memory/CPU, latency,
   container restart, and logs. Increase `basic` only if measurements require.

Stop if any critical flow differs, if the Google key leaks, if performance is
unacceptable, or if Workers Paid/Containers is unavailable.

## Production release and cron handover

Prepare a production config with the same tested public values, deploy its
Worker with **no routes and no crons**, configure its secrets, and repeat a
smoke check on its temporary hostname. Do not add the draft OpenAI Ads cron
unless it was actually deployed to Vercel by branch freeze.

The five current Vercel schedules map to Cloudflare as follows (UTC):

| Path | Cloudflare cron |
| --- | --- |
| `/api/pinterest/cron` | `0 1 * * *` |
| `/api/collections/trends/cron` | `0 2 * * MON` |
| `/api/collections/refresh/cron` | `0 3 * * MON` |
| `/api/seo/cron` | `0 * * * *` |
| `/api/studio/cron` | `15 * * * *` |

Cloudflare uses a different weekday numbering from Vercel, hence `MON`. The
Worker has a per-scheduled-time Redis lock, but it cannot prevent a Vercel job
from running at the same time. Choose a handover window between cron slots:

1. Disable Vercel crons at the Vercel deployment/configuration level and
   confirm they are no longer scheduled. Do not merely rely on a code branch.
2. Add the five expressions above to the **production** `triggers.crons`,
   deploy, and confirm the triggers are active. Cloudflare propagation can be
   delayed; do not manually invoke jobs during that gap.
3. For each next scheduled slot, check exactly one successful execution and
   its expected effect. On failure, inspect before retrying: the Redis lock is
   deliberately retained because a route may have partially written data.

Once DNS is reconciled, switch nameservers while Vercel still serves the web
origin. Verify records, TLS, mail, and redirects. Then proxy apex and `www`
through Cloudflare and add Worker Routes for both hostnames to the tested
production Worker. Keep Vercel as rollback origin. Observe checkout, webhooks,
AI, image hashes, cron results, error rates, and latency for 72 hours.

Rollback web traffic by removing Worker Routes and restoring the Vercel origin.
Rollback cron ownership separately: disable Cloudflare triggers, verify that
the last slot finished, then re-enable Vercel crons. Avoid any overlapping
schedule. Retire the Vercel project only after the rollback window and every
external callback has been checked against the new host.
