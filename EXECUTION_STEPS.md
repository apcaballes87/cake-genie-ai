# Execution Steps: Updating Genie.ph with Bill-Sharing App

## Phase 1: Preparation and Backup

### Step 1: Create Backup Branch
```bash
cd /Users/apcaballes/genieph
git checkout -b backup-before-bill-sharing-update
git add .
git commit -m "Backup before updating with bill-sharing app"
git push origin backup-before-bill-sharing-update
```

### Step 2: Document Current Configuration
- Take note of current VITE_GEMINI_API_KEY value in Vercel
- Document current package.json dependencies
- Note any custom environment variables

## Phase 2: Environment Variable Setup

### Step 3: Update Config File
We need to update the config.ts file to maintain Vercel compatibility while incorporating any new configuration from the bill-sharing app.

First, let's backup the current config:
```bash
cp /Users/apcaballes/genieph/config.ts /Users/apcaballes/genieph/config.ts.backup
```

### Step 4: Update Gemini Service
Update the geminiService.ts file to use the Vite environment variable approach while incorporating any new features from the bill-sharing version.

Backup current service:
```bash
cp /Users/apcaballes/genieph/services/geminiService.ts /Users/apcaballes/genieph/services/geminiService.ts.backup
```

## Phase 3: Selective File Migration

### Step 5: Update Core Application Files
Let's compare and update the key files:

1. **App.tsx**: Merge new features while preserving existing functionality
2. **index.html**: Update with any new meta tags or scripts
3. **package.json**: Preserve Vite configuration while adding any new dependencies

### Step 6: Update Components
Selectively copy new components from the bill-sharing app:
- Check for new components in [/Users/apcaballes/genieph---bill-sharing/components](file:///Users/apcaballes/genieph---bill-sharing/components)
- Compare with existing components in [/Users/apcaballes/genieph/components](file:///Users/apcaballes/genieph/components)
- Merge new features while preserving existing functionality

### Step 7: Update Services
Update services to incorporate new functionality:
- Check for new services in [/Users/apcaballes/genieph---bill-sharing/services](file:///Users/apcaballes/genieph---bill-sharing/services)
- Compare with existing services in [/Users/apcaballes/genieph/services](file:///Users/apcaballes/genieph/services)
- Preserve API key handling approach

## Phase 4: Configuration Updates

### Step 8: Update Environment Variable Handling
Ensure all files use `import.meta.env.VITE_GEMINI_API_KEY` instead of `process.env.API_KEY`:

```bash
# Find all files that reference process.env.API_KEY
grep -r "process.env.API_KEY" /Users/apcaballes/genieph---bill-sharing/
```

### Step 9: Update Package.json
Preserve the Vite configuration while potentially adding new dependencies:

```bash
# Compare dependencies
diff /Users/apcaballes/genieph/package.json /Users/apcaballes/genieph---bill-sharing/package.json
```

## Phase 5: Testing

### Step 10: Local Development Testing
```bash
cd /Users/apcaballes/genieph
npm run dev
```
- Verify the application starts correctly
- Test API key integration
- Test all new features

### Step 11: Build Testing
```bash
npm run build
```
- Verify the build completes successfully
- Check for any errors or warnings

## Phase 6: Deployment Preparation

### Step 12: Verify Vercel Environment Variables
- Check that VITE_GEMINI_API_KEY is set in Vercel
- Verify other environment variables are preserved

### Step 13: Create Deployment Branch
```bash
git checkout -b update-with-bill-sharing-app
```

### Step 14: Commit Changes
```bash
git add .
git commit -m "Update genie.ph with bill-sharing app features while maintaining Vercel compatibility"
```

## Phase 7: Deployment

### Step 15: Deploy to Vercel
- Push changes to trigger Vercel deployment
- Monitor deployment logs for any issues
- Test deployed application

## Rollback Plan

If issues occur:
1. Revert to backup branch:
   ```bash
   git checkout main
   git reset --hard backup-before-bill-sharing-update
   ```
2. Redeploy previous version
3. Investigate and fix issues before retrying

## Success Criteria

- Application builds and deploys successfully
- All existing functionality is preserved
- New bill-sharing features work correctly
- API key integration works in both local and Vercel environments
- No breaking changes to user experience