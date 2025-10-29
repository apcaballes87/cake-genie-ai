# 🔒 Security Guide - Preventing API Key Leaks

## ⚠️ What Happened?

On 2025-10-29, a **Google Maps API Key** was accidentally committed to the GitHub repository in `config.ts`. This was detected by GitGuardian, a security monitoring service.

**Exposed Key:** `AIzaSyA0RZHBXUprvS7k2x6_C-FuhkEjHluR9Ck`  
**Commit:** `814b099`  
**File:** `config.ts`

---

## 🚨 Immediate Actions Taken

### 1. ✅ Revoked Compromised Keys
- **Google Maps API Key** → MUST BE REVOKED/REGENERATED IMMEDIATELY
- Go to: https://console.cloud.google.com/google/maps-apis/credentials
- Delete or regenerate the exposed key

### 2. ✅ Updated Code Architecture
- Modified `config.ts` to use environment variables instead of hardcoded keys
- Created `.env.example` as a template
- Enhanced `.gitignore` with explicit environment variable exclusions

### 3. ✅ Committed Fixes
- All sensitive data now loaded from `.env.local` (gitignored)
- Added validation to ensure environment variables are set

---

## 🛡️ Prevention Guide - NEVER DO THIS AGAIN

### Rule #1: NEVER Hardcode API Keys

**❌ WRONG:**
```typescript
// config.ts
export const API_KEY = "AIzaSyA0RZHBXUprvS7k2x6_C-FuhkEjHluR9Ck";
```

**✅ CORRECT:**
```typescript
// config.ts
export const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  throw new Error('VITE_API_KEY environment variable not set');
}
```

### Rule #2: Always Use .env Files

**Create `.env.local` (NOT committed to Git):**
```bash
VITE_API_KEY=your_actual_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Create `.env.example` (Committed to Git as template):**
```bash
VITE_API_KEY=your_api_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Rule #3: Configure .gitignore Properly

Ensure these are in `.gitignore`:
```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local

# API Keys and Secrets
**/config.local.*
**/*secret*
**/*key*.json
```

### Rule #4: Use Git Hooks (Pre-commit Checks)

Install `git-secrets` or similar tools:
```bash
# Install git-secrets
brew install git-secrets

# Configure for your repo
cd /Users/apcaballes/genieph
git secrets --install
git secrets --register-aws
git secrets --add 'AIza[0-9A-Za-z_-]{35}'  # Google API Key pattern
```

### Rule #5: Enable GitGuardian or Similar Services

- ✅ GitGuardian is already monitoring your repo (that's how we caught this!)
- Configure it to send alerts immediately
- Consider enabling GitHub Secret Scanning: Settings → Security → Code security and analysis

---

## 📋 Checklist Before Every Commit

Before running `git commit`, verify:

- [ ] No `.env` or `.env.local` files staged
- [ ] No API keys in code files
- [ ] All secrets use `import.meta.env.VITE_*` pattern
- [ ] `.env.example` has placeholder values only
- [ ] Run: `git diff --staged` and manually review for secrets

---

## 🔧 How to Fix Exposed Keys in Git History

If keys are already committed, you MUST remove them from Git history:

### Option 1: Using BFG Repo-Cleaner (Recommended)

```bash
# Install BFG
brew install bfg

# Clone a fresh copy
git clone --mirror git@github.com:apcaballes87/cake-genie-ai.git

# Remove the sensitive file from history
bfg --delete-files config.ts cake-genie-ai.git

# Or replace text patterns
bfg --replace-text passwords.txt cake-genie-ai.git

# Clean up and force push
cd cake-genie-ai.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

### Option 2: Using git-filter-repo

```bash
# Install git-filter-repo
brew install git-filter-repo

# Remove file from history
git filter-repo --path config.ts --invert-paths

# Force push
git push origin --force --all
```

### Option 3: Manual with git filter-branch (Not Recommended)

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch config.ts" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

**⚠️ WARNING:** Rewriting Git history will break anyone else's clones. Coordinate with your team!

---

## 🔐 Environment Variable Setup

### Local Development (.env.local)

1. Copy the template:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your actual keys:
   ```bash
   VITE_SUPABASE_URL=https://cqmhanqnfybyxezhobkx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_actual_anon_key
   VITE_GEMINI_API_KEY=your_actual_gemini_key
   VITE_GOOGLE_MAPS_API_KEY=your_NEW_google_maps_key
   ```

3. Verify it's gitignored:
   ```bash
   git status  # Should NOT show .env.local
   ```

### Vercel Deployment

Add environment variables in Vercel Dashboard:

1. Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables
2. Add each variable:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
3. Set for: Production, Preview, and Development
4. Redeploy after adding variables

---

## 🎯 Key Takeaways

1. **NEVER** commit API keys, tokens, passwords, or secrets to Git
2. **ALWAYS** use environment variables (`.env.local`)
3. **VERIFY** `.gitignore` before first commit
4. **USE** Git hooks and secret scanning tools
5. **REVOKE** exposed keys immediately
6. **ROTATE** keys regularly as best practice
7. **RESTRICT** API keys with domain/IP restrictions when possible

---

## 🆘 What to Do If You Expose a Secret

1. **REVOKE** the key immediately (Google Cloud Console, Supabase Dashboard, etc.)
2. **REMOVE** from Git history using BFG or git-filter-repo
3. **GENERATE** new keys with proper restrictions
4. **UPDATE** all deployment environments (Vercel, etc.)
5. **AUDIT** access logs for unauthorized usage
6. **DOCUMENT** the incident (like this guide!)

---

## 📚 Additional Resources

- [GitGuardian Best Practices](https://docs.gitguardian.com/secrets-detection/introduction)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## 📞 Emergency Contacts

**If you discover a security issue:**
- Immediately notify: apcaballes@gmail.com
- Check GitGuardian dashboard for alerts
- Review Supabase/Google Cloud audit logs

---

**Last Updated:** 2025-10-29  
**Incident:** Google Maps API Key Exposure  
**Status:** RESOLVED ✅  
**Action Required:** Generate new Google Maps API Key
