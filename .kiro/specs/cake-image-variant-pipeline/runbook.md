# Cake Image Variant Pipeline — operator runbook

Runtime guide for shipping, monitoring, and rolling back the variant pipeline.
Spec: `.kiro/specs/cake-image-variant-pipeline/{requirements,design,tasks}.md`.

This file is updated as tasks complete. Each section maps to a task ID in
`tasks.md`.

---

## Phase 1 — Foundation

### 1.1 Migration

**Status:** ✅ applied to production Supabase.

Migration files:
- `supabase/migrations/20260601000000_add_image_variants_to_analysis_cache.sql`
- `supabase/migrations/20260601000000_add_image_variants_to_analysis_cache.runbook.md`
- `supabase/migrations/20260601000100_image_variants_coverage_view_security_invoker.sql`

Verification done at apply time:

```sql
SELECT * FROM public.cakegenie_image_variants_coverage;
-- => { eligible_rows: 10583, covered_rows: 0, failed_rows: 0, partial_rows: 0 }
```

Schema changes are additive and forward-compatible. Existing reads of
`cakegenie_analysis_cache` continue to work unchanged.

### 1.2 Sharp moved to dependencies + vercel.json maxDuration

**Status:** ✅ done.

- `package.json` — `sharp ^0.34.5` is now under `dependencies` (was
  `devDependencies`).
- `vercel.json` — added `functions` block setting `maxDuration: 60` for
  `src/app/api/internal/variant-pipeline/route.ts`. Pro tier required for
  values above 10s; project is already on Pro.

Verify after `npm ci` in CI:

```bash
node -e "process.exit(require('./package.json').dependencies.sharp ? 0 : 1)"
```

### 1.3 SUPABASE_WEBHOOK_SECRET

**Local:** ✅ generated and saved to `.env.local`. Generation command:

```bash
openssl rand -hex 32
```

**`.env.example`:** ✅ documented at the bottom of the file with rotation
notes.

**Vercel production + preview:** ⚠ NOT YET SET. Operator action required:

1. Go to Vercel dashboard → project → Settings → Environment Variables.
2. Add `SUPABASE_WEBHOOK_SECRET` for both `Production` and `Preview`.
3. Use a fresh 32-byte hex value (do NOT reuse the local dev secret).
4. After setting, redeploy preview/production for the new env to take effect.

**Supabase webhook header:** ⚠ NOT YET SET. Will be configured in Phase 4.4
when the database webhook is created. The header
`x-supabase-webhook-secret` must equal the value above.

### Deferred rotation

Single static secret for v1. To rotate later:

1. Add the new secret to Vercel env (don't remove old).
2. Update the route handler to accept either old or new for ~5 minutes.
3. Update Supabase webhook config to send the new value.
4. After traffic flips, remove the old value from Vercel and the route.

---

## Phase 2 — Library

(Will be filled in as tasks complete.)

---

## Phase 4 — Webhook setup

(Will be filled in. Includes the ⚠ Supabase webhook configuration step that
requires operator approval.)

---

## Phase 7 — Backfill operations

(Will be filled in. Includes the ⚠ production validation run, ⚠ full
production run, and the failures-NDJSON analysis pattern.)
