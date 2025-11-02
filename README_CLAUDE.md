# ⚠️ IMPORTANT NOTES FOR CLAUDE CODE ⚠️

## CRITICAL: Migration Protocol

**BEFORE migrating ANY code from another folder, ALWAYS read this file and follow `.claude/MIGRATION_CHECKLIST.md`**

### Key Rules - NEVER BREAK THESE:

1. **NEVER commit `config.ts` with real API keys**
   - Always use environment variables: `import.meta.env.VITE_GEMINI_API_KEY || "fallback"`
   - Check `.gitignore` includes `config.ts`
   - Use `git diff` before committing to verify no secrets

2. **NEVER use `git add -f config.ts`** unless absolutely necessary for emergency production fix

3. **ALWAYS verify these after migration:**
   - [ ] `config.ts` is in `.gitignore`
   - [ ] `import './index.css'` exists in `index.tsx`
   - [ ] `tsconfig.json` excludes `supabase/functions/`
   - [ ] Vercel environment variables are set

4. **If GitGuardian detects a leak:**
   - Run `git filter-repo` immediately
   - Remove key from history
   - Force push cleaned history
   - Update Vercel environment variables

## Current API Keys (DO NOT COMMIT THESE)

- **Gemini API:** Stored in Vercel as `VITE_GEMINI_API_KEY`
- **Supabase:** Public anon key (safe to commit) + service role key (NEVER commit)
- **Google Maps:** Safe to commit (client-side restricted)

## Project-Specific Issues to Remember

### Issue: "process is not defined"
**Fix:** Use `import { GEMINI_API_KEY } from '../config'` instead of `process.env`

### Issue: White page / no CSS
**Fix:** Ensure `import './index.css'` is in `index.tsx` line 3

### Issue: Vercel build fails
**Fix:** Check `tsconfig.json` excludes `supabase/functions/`

### Issue: Facebook sharing shows data URI
**Fix:** Ensure `shareService.ts` uploads images to Supabase Storage

### Issue: Shared design link shows 401 error
**Fix:** Deploy Edge Function with `--no-verify-jwt` flag

## Migration History

| Date | Source | Issues Encountered | Resolved |
|------|--------|-------------------|----------|
| 2025-11-02 | genieph---html-hybrid | API key leaked, missing CSS, process.env errors | ✅ Yes |
| 2025-11-03 | (future) | | |

## Emergency Commands

### Remove leaked secret from git history:
```bash
git filter-repo --replace-text <(echo 'LEAKED_KEY==>***REMOVED***') --force
git remote add origin https://github.com/apcaballes87/cake-genie-ai.git
git push --force origin main
```

### Test locally before pushing:
```bash
npm run dev
# Check browser console for errors
# Test image upload + AI analysis
```

### Deploy Supabase Edge Functions:
```bash
export SUPABASE_ACCESS_TOKEN=sbp_0debbcfcdb4e5888dfa5667fe1405d3e72ff63b4
supabase functions deploy share-design --no-verify-jwt
```

---

**When in doubt, ask the user before committing!**
