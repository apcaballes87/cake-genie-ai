# Creator Form Fix — Production RPC Dependency

## What Happened
- **Symptom**: The deployed creators form returned `Creator applications are temporarily unavailable. Please try again later.` below the submit button.
- **Root cause**: Vercel was reaching the production RPC, but the RPC failed with PostgreSQL `42883`: `function gen_random_bytes(integer) does not exist`. Production has `pgcrypto` installed in the `extensions` schema, while the SECURITY DEFINER function locked its `search_path` to `public, pg_catalog, pg_temp`, so the unqualified generator call could not resolve.
- **Verified production state**: Vercel production is deployed from commit `37fa6ec` and has `NEXT_PUBLIC_SUPABASE_URL` pointing to `cqmhanqnfybyxezhobkx.supabase.co` plus a configured `SUPABASE_SERVICE_ROLE_KEY`. The production RPC has the expected 13-argument signature and service-role permission. All five creator migrations are recorded in Supabase.

## What Was Fixed
- `supabase/migrations/20260820090000_creator_promotion_codes.sql` now creates pgcrypto in `extensions` and qualifies both random-code calls with `extensions.gen_random_bytes` for fresh databases.
- `supabase/migrations/20260823090000_fix_creator_pgcrypto_search_path.sql` applies the same dependency to the already-deployed function by ensuring pgcrypto exists and adding `extensions` to its locked `search_path`.
- `src/app/creators/actions.ts` continues to map infrastructure failures to the existing friendly result, with the alert rendered below the submit button. It was not changed for this database fix.

## Production Migration
The migration was applied to the production Supabase project as `20260823080651`. It changes only the function dependency/search path and creates the already-supported pgcrypto extension if needed; it did not insert or modify creator application data.

## Verification
- Vercel runtime logs identified the exact `42883` failure in `submit_creator_application`.
- Production read-only checks confirmed the creators/discount-code schema, RPC signature, service-role execution, and anon denial.
- Focused regression coverage includes the observed `gen_random_bytes(integer)` failure mapping.

## Key Files
- `src/app/creators/actions.ts` — server action returns result union
- `src/app/creators/page.tsx` — handles result inline, no thrown errors
- `src/app/creators/error.tsx` — error boundary safety net
- `supabase/migrations/20260820053428_*` through `20260820054756_*` — applied to this project
- `supabase/migrations/20260823090000_fix_creator_pgcrypto_search_path.sql` — applied remotely as `20260823080651`
