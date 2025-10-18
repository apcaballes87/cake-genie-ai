# 🚨 SECURITY INCIDENT RESPONSE - IMMEDIATE ACTION REQUIRED

**Date**: October 18, 2025
**Severity**: CRITICAL
**Status**: EXPOSED API KEYS IN GIT HISTORY

---

## What Happened

GitGuardian detected that **real API keys** were committed to your public/private repository in `.env.example` and hardcoded in source files. The following credentials are compromised:

### Exposed Credentials:
1. ✅ **Gemini API Key**: `AIzaSyAJR4N81G-d1WV5x6uKdmE1Q6ho5LC1Dbc`
2. ✅ **Supabase URL**: `https://cqmhanqnfybyxezhobkx.supabase.co`
3. ✅ **Supabase Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. ✅ **Google CSE ID**: `825ca1503c1bd4d00`

### Affected Commit:
- **Commit**: f18557bff0d5f7dd11aeb5c5b3463979b1a3670a
- **File**: `.env.example`
- **Date**: October 18, 2025

---

## IMMEDIATE ACTIONS (Do These NOW - In Order)

### 1. Rotate Gemini API Key ⚠️ CRITICAL

**Why**: Anyone can use your Gemini API key to make requests and you'll be billed.

**Steps**:
1. Go to: https://aistudio.google.com/app/apikey
2. Find the key: `AIzaSyAJR4N81G-d1WV5x6uKdmE1Q6ho5LC1Dbc`
3. **DELETE** this key immediately
4. Create a **NEW** API key
5. Update your `.env` file with the new key:
   ```bash
   VITE_GEMINI_API_KEY="your-new-key-here"
   ```
6. **NEVER** commit the new key to git

**Check for unauthorized usage**:
- Go to Google Cloud Console > APIs & Services > Credentials
- Check quota/usage for suspicious activity
- Review billing for unexpected charges

---

### 2. Rotate Google Custom Search Engine ID ⚠️ IMPORTANT

**Why**: The CSE ID is now public and could be abused.

**Steps**:
1. Go to: https://programmablesearchengine.google.com/
2. Find your search engine
3. **Option A** (Recommended): Create a NEW search engine
   - Copy all settings from the old one
   - Get the new CSE ID
4. **Option B**: Delete and recreate the existing one
5. Update your `.env` file:
   ```bash
   VITE_GOOGLE_CSE_ID="your-new-cse-id-here"
   ```

---

### 3. Check Supabase Security ⚠️ MODERATE

**Why**: The anon key has row-level security, but URL is exposed.

**Steps**:
1. Go to: https://supabase.com/dashboard/project/cqmhanqnfybyxezhobkx
2. Navigate to **Settings** > **API**
3. **Check**:
   - Row Level Security (RLS) is enabled on all tables ✓
   - Service role key is NOT exposed ✓
   - Only anon key is exposed (this is okay if RLS is properly configured)

**Verify RLS**:
```sql
-- Run this in Supabase SQL Editor
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```
All tables should show `rowsecurity = true`

**If RLS is NOT enabled**:
1. Enable RLS on all tables immediately
2. Create proper policies for authenticated/anonymous users
3. Test that unauthenticated users can't access sensitive data

**Supabase Anon Key Info**:
- The anon key is designed to be public-facing
- It's safe IF you have proper Row Level Security (RLS) policies
- Monitor your Supabase dashboard for suspicious activity

---

### 4. Clean Git History 🧹 REQUIRED

**Why**: The keys are in git history and will remain there forever unless removed.

**⚠️ WARNING**: This rewrites git history and will affect anyone who has cloned your repo.

**Option A: If this is a NEW repo with no collaborators** (Recommended):
```bash
# Delete the repository from GitHub/GitLab
# Then create a fresh repo with the fixed code
```

**Option B: Use BFG Repo-Cleaner** (If you have collaborators):
```bash
# 1. Install BFG
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# 2. Clone a fresh copy
git clone --mirror git@github.com:apcaballes87/cake-genie-ai.git

# 3. Run BFG to remove secrets
bfg --replace-text secrets.txt cake-genie-ai.git

# Create secrets.txt file with:
# AIzaSyAJR4N81G-d1WV5x6uKdmE1Q6ho5LC1Dbc
# eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks
# 825ca1503c1bd4d00

# 4. Clean up and push
cd cake-genie-ai.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

**Option C: Use git filter-repo** (Alternative):
```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove the sensitive file from history
git filter-repo --path .env.example --invert-paths

# Force push
git push --force --all
```

---

### 5. Update All Files (ALREADY DONE ✓)

The following fixes have been applied:
- ✅ `.env.example` now contains only placeholders
- ✅ Google CSE ID moved to environment variable
- ✅ `useSearchEngine.ts` now reads from `import.meta.env.VITE_GOOGLE_CSE_ID`

**Commit these changes**:
```bash
git add .
git commit -m "security: Move API keys to environment variables and sanitize .env.example"
git push
```

---

### 6. Set Up Secret Scanning

**GitHub** (if using):
1. Go to repo Settings > Security > Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection"

**Pre-commit Hook** (Recommended):
```bash
# Install gitleaks
brew install gitleaks

# Create .git/hooks/pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
gitleaks protect --staged --verbose
EOF

chmod +x .git/hooks/pre-commit
```

---

## Monitoring & Verification

### Check for Unauthorized Usage:

1. **Gemini API**:
   - Google Cloud Console > Billing
   - Check for unexpected API calls

2. **Google CSE**:
   - Programmable Search Engine Console
   - Monitor query volume

3. **Supabase**:
   - Dashboard > Settings > Usage
   - Check for abnormal activity
   - Review auth logs

---

## Prevention Checklist

- [ ] All API keys rotated
- [ ] `.env.example` contains only placeholders
- [ ] `.env` is in `.gitignore`
- [ ] Git history cleaned
- [ ] Secret scanning enabled
- [ ] Pre-commit hooks installed
- [ ] Team notified (if applicable)
- [ ] Monitoring enabled for all services

---

## Files Changed (Auto-fixed by Claude)

1. `.env.example` - Replaced real keys with placeholders
2. `.env` - Added `VITE_GOOGLE_CSE_ID`
3. `src/hooks/useSearchEngine.ts` - Now uses env variable instead of hardcoded CSE ID

---

## Questions?

If you need help with any of these steps, please ask!

**Priority Order**:
1. Rotate Gemini API Key (Highest - costs money)
2. Rotate Google CSE ID
3. Verify Supabase RLS
4. Clean git history
5. Set up monitoring

---

**REMEMBER**: Even after rotating keys, the old keys remain in git history until you clean it!
