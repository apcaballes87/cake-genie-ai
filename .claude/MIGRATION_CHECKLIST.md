# Migration Checklist for Genie.ph

**IMPORTANT:** Follow this checklist EVERY TIME you migrate a new version from another folder to this project.

## Pre-Migration

- [ ] Backup current version: `git branch backup-before-migration-$(date +%Y%m%d)`
- [ ] Identify source folder (e.g., `/Users/apcaballes/genieph---html-hybrid`)
- [ ] Ask user: "Do you want to completely replace or merge?"

## Critical Files That Must NEVER Be Committed

### 1. config.ts
- **Location:** `/Users/apcaballes/genieph/config.ts`
- **Contains:** API keys (Gemini, Google Maps, Supabase, etc.)
- **Action:**
  - ✅ Always ensure it's in `.gitignore`
  - ✅ Use environment variables: `import.meta.env.VITE_GEMINI_API_KEY || "fallback"`
  - ✅ NEVER use `git add -f config.ts` unless absolutely necessary
  - ✅ If committed accidentally, immediately run git-filter-repo to remove

### 2. .env files
- **Location:** `.env`, `.env.local`
- **Contains:** API keys and secrets
- **Action:** Always in `.gitignore`, never commit

## Post-Migration Checklist

### Step 1: Verify .gitignore
```bash
cat .gitignore | grep -E "(config.ts|\.env)"
```
Expected output:
```
config.ts
.env
.env.local
```

### Step 2: Check for Leaked Secrets BEFORE Committing
```bash
git diff | grep -E "(AIza|sbp_|sk-)"
```
If this returns anything, DO NOT COMMIT. Remove the secrets first.

### Step 3: Verify config.ts Uses Environment Variables
```bash
grep "import.meta.env" config.ts
```
Expected: `export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "fallback";`

### Step 4: Update Vercel Environment Variables
Go to Vercel Dashboard → Project → Settings → Environment Variables

Required variables:
- `VITE_GEMINI_API_KEY` = [Current Gemini API key]
- `VITE_SUPABASE_URL` = https://cqmhanqnfybyxezhobkx.supabase.co
- `VITE_SUPABASE_ANON_KEY` = [Supabase anon key]
- `VITE_GOOGLE_CSE_ID` = 825ca1503c1bd4d00

### Step 5: Test Locally Before Pushing
```bash
npm run dev
```
- [ ] Site loads without errors
- [ ] API calls work (check browser console)
- [ ] Image upload works
- [ ] Gemini API returns results

### Step 6: Safe Git Commit Process
```bash
# 1. Check status
git status

# 2. Review changes carefully
git diff

# 3. NEVER add config.ts or .env files
git add <specific-files-only>

# 4. Commit with descriptive message
git commit -m "feat: Migrate new version from [source]"

# 5. Push to GitHub
git push
```

## Common Migration Issues & Solutions

### Issue 1: "process is not defined" Error
**Cause:** Code using `process.env` in browser
**Solution:** Update to use config exports:
```typescript
// ❌ BAD
const apiKey = process.env.GEMINI_API_KEY;

// ✅ GOOD
import { GEMINI_API_KEY } from '../config';
```

### Issue 2: Missing CSS / White Page
**Cause:** Missing `import './index.css'` in index.tsx
**Solution:** Add import at top of index.tsx

### Issue 3: Vercel Build Fails - TypeScript Compiling Deno Functions
**Cause:** TypeScript trying to compile `supabase/functions/`
**Solution:** Update tsconfig.json:
```json
{
  "exclude": ["node_modules", "dist", "supabase/functions", "supabase/.temp"]
}
```

### Issue 4: GitGuardian Detects Leaked API Key
**Solution:**
```bash
# 1. Remove from history
git filter-repo --replace-text <(echo 'LEAKED_KEY==>***REMOVED***') --force

# 2. Restore key locally
# Edit config.ts to restore the key

# 3. Re-add remote and force push
git remote add origin https://github.com/apcaballes87/cake-genie-ai.git
git push --force origin main

# 4. Update Vercel environment variables
# Go to Vercel dashboard and set VITE_GEMINI_API_KEY
```

### Issue 5: Facebook Sharing Shows Data URI Instead of Image
**Cause:** Images saved as base64 instead of uploaded to Supabase Storage
**Solution:** Ensure `shareService.ts` has `uploadImageToStorage()` function

## File Structure Reference

```
genieph/
├── config.ts              # ⚠️  NEVER COMMIT - Contains API keys
├── .env                   # ⚠️  NEVER COMMIT - Local env vars
├── .gitignore            # ✅ Must include config.ts and .env
├── package.json          # ✅ Safe to commit
├── tsconfig.json         # ✅ Safe to commit (check exclude)
├── index.html            # ✅ Safe to commit
├── index.tsx             # ✅ Safe to commit (check for import './index.css')
├── app/                  # ✅ Safe to commit
├── components/           # ✅ Safe to commit
├── services/             # ✅ Safe to commit
├── hooks/                # ✅ Safe to commit
├── lib/                  # ✅ Safe to commit
└── supabase/
    ├── migrations/       # ✅ Safe to commit
    └── functions/        # ✅ Safe to commit (but exclude from tsconfig)
```

## Emergency Contacts

- **GitGuardian Alert:** Mark as "Won't Fix" if key is already in Vercel env vars
- **Vercel Deployment Failed:** Check build logs for TypeScript errors
- **API Key Disabled:** Generate new key and update Vercel env vars immediately

## Post-Migration Deployment Checklist

- [ ] Code committed to GitHub
- [ ] Vercel auto-deploys (wait 2-3 minutes)
- [ ] Visit genie.ph and test:
  - [ ] Homepage loads
  - [ ] Image upload works
  - [ ] AI analysis works
  - [ ] Image editing works
  - [ ] Share design creates proper links
  - [ ] Facebook sharing debugger shows image (not data URI)
- [ ] Check Vercel deployment logs for errors
- [ ] Monitor for GitGuardian alerts

---

**Last Updated:** 2025-11-03
**Migration Count:** 2 (this document created after 2nd migration)
