# Cloudflare staging database review

This draft initializes an isolated Supabase staging database. It does not repair,
append to, or replace production migration history. Do not run it against production.

## Captured schema

Read-only native `pg_dump` completed against `Cake Genie`
(`cqmhanqnfybyxezhobkx`, PostgreSQL 17.6) on 2026-10-03. TCP and PostgreSQL login
work. GSS encryption was disabled and SSL required for the successful connection;
the dump also needed sufficient time to collect the catalog. Docker was unnecessary.

`schema-baseline.sql` contains 79 tables, 124 public application functions plus
five private RLS helper functions, eight views, 172 public policies, and 32 public
triggers. Extension-owned functions are installed through the extension definitions.
`managed-schema-app-objects.sql` adds the two app triggers on `auth.users` and 32
Storage policies without recreating Supabase's managed tables.

`inventory.json` records source metadata and Storage bucket configuration.
`schema-baseline.manifest.json` records hashes, object counts, and every omitted
source object. The credential-bearing raw dump stays outside the repository in a
private directory; the staging draft passed literal and token-pattern scans.

## Intentional staging changes

- Omit `geniepurchase` on `cakegenie_orders`, `uploadmerchantproduct` on
  `cakegenie_merchant_products`, and `variant_pipeline` on
  `cakegenie_analysis_cache`. These call live external services; the last also
  contains an embedded production credential.
- Preserve the signature of `public.trigger_retry_webhook`, but replace its
  outbound call with an explicit staging-disabled exception.
- Make `public.admin_create_shared_cart` return a staging Worker cart link.
- Leave platform event triggers, managed publication definitions, managed-schema
  grants, and `supabase_admin` default privileges under Supabase's ownership.
  Preserve the app's three public-table realtime publication memberships.
- Preserve existing RLS behavior for comparison. The nine source tables with RLS
  disabled are listed in `inventory.json`; production policy remediation remains
  a separate review. Staging will contain public configuration and synthetic test
  data only.
- Do not copy customer records, auth identities, orders, payments, cron rows,
  Vault secrets, or provider secrets. Seed needed catalog/configuration and
  synthetic fixtures separately.

## Staging initialization

The temporary branch is `cloudflare-staging` (`eukfiktniwjtfjwjuvia`), parent
`cqmhanqnfybyxezhobkx`. Its inherited replay encountered the same
missing historical table and retains `MIGRATIONS_FAILED`; the preview project is healthy and the application baseline was imported manually in one transaction. Verify the branch project ref before every write,
inventory its partial objects, and remove only those identified branch remnants
before importing this baseline in a transaction. Apply the managed app objects
afterward and verify the actual schema and Data API rather than changing a status
label to imply success.

Do not reset, rebase, or merge the manually initialized staging branch. Those
operations replay the incomplete parent history or can target production.

## Remaining verification

- Authenticated API and synthetic user probes. Schema import succeeded; verified 79 tables, 129 app functions, 172 public policies, 32 Storage policies, two Auth triggers, and zero omitted outbound hooks. The branch Data API returned HTTP 200.
- Branch Storage buckets, disposable image fixtures, Auth redirects, and public
  catalog/pricing/active-prompt seeds.
- Isolated runtime credentials and external provider test settings. Xendit tests
  require branch functions with test-only payment credentials.
- Cloudflare Linux Container build/deployment and matched safe Genie requests.

The temporary Supabase branch costs $0.01344/hour (approximately $0.32/day) while
it exists, independently of Cloudflare usage. Delete it after the comparison.

References: [Supabase branching workflow](https://supabase.com/docs/guides/deployment/branching),
[manual branch operations](https://supabase.com/docs/guides/deployment/branching/dashboard),
and [empty branch troubleshooting](https://supabase.com/docs/guides/troubleshooting/new-branch-doesnt-copy-database).

## Execution update

The staging application schema and allowlisted configuration/public-design seeds were imported successfully. Staging `cakegenie` and `chat-images` buckets were created. Worker typecheck and diff checks pass. Cloudflare deployment is waiting for authenticated Builds settings access: current Wrangler OAuth returns HTTP 403 for Builds, and the browser is signed out. No Container deployment or performance result is claimed.
