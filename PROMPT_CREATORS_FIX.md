# Creator Form 500 Fix — Context for Next Session

## What Happened
- **Symptom**: `POST https://genie.ph/creators` returned **500** in production, triggering the generic "Server Components render" error boundary.
- **Root cause**: Production Vercel deployment missing `SUPABASE_SERVICE_ROLE_KEY` (or pointed at a different Supabase project). The server action `submitCreatorApplication` threw an error → 500 → RSC error boundary.
- **Local state**: `.env.local` points to `cqmhanqnfybyxezhobkx.supabase.co` which **has all 5 creator migrations applied** (verified via MCP). RPCs `submit_creator_application` and `validate_creator_discount_code` work locally.

## What Was Fixed (Code Hardening)
**Commit `e25e47d2`** — `src/app/creators/actions.ts`:
- `submitCreatorApplication` now returns a **result object** (`{ success: true, ... } | { success: false, error, code }`) instead of throwing.
- Client (`page.tsx`) handles the result inline — no try/catch on thrown errors.
- No more unhandled 500 from the action; user sees a friendly message instead of the RSC error overlay.
- Added `src/app/creators/error.tsx` as a final safety net.

## Remaining Production Config (Required for Form to Actually Work)
The code no longer crashes, but **codes won't be generated** until production has the Supabase connection:

| Vercel Prod Env Var | Value |
|---------------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cqmhanqnfybyxezhobkx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase Dashboard → Settings → API |

If production uses a **different** Supabase project, apply these 5 migrations there too:
1. `20260820053428_creator_promotion_codes`
2. `20260820053653_enforce_creator_discount_rules`
3. `20260820054207_reconcile_creator_columns`
4. `20260820054635_limit_creator_bento_to_one`
5. `20260820054756_lock_creator_rpc_permissions`

## Verification
- ESLint: 0 errors (only pre-existing `<img>` warnings)
- Test: `src/app/creators/actions.test.ts` ✓
- Committed-only build: `next build` → EXIT 0, `/creators` + `/cart` prerender as static

## Key Files
- `src/app/creators/actions.ts` — server action returns result union
- `src/app/creators/page.tsx` — handles result inline, no thrown errors
- `src/app/creators/error.tsx` — error boundary safety net
- `supabase/migrations/20260820053428_*` through `20260820054756_*` — applied to this project