# Pre-Import Checklist

## Critical Issues to Address Before Importing Updated App

### 1. API Key Issues (HIGH PRIORITY)
- [ ] **Generate a new Gemini API key** from Google AI Studio:
  1. Go to https://aistudio.google.com/app/apikey
  2. Create a new API key
  3. Copy the new key
- [ ] **Update [.env.local](file:///Users/apcaballes/genieph/.env.local) with the new API key**:
  1. Open [.env.local](file:///Users/apcaballes/genieph/.env.local) file
  2. Replace the current `VITE_GEMINI_API_KEY` value with the new key
  3. Save the file
- [ ] **Verify the new API key works**:
  1. Run the test script: `node test-api-key.cjs`
  2. Confirm you get a "API key is valid and working!" message

### 2. Environment Variable Verification
- [ ] **Verify all environment variables are correctly set**:
  - [ ] `VITE_GEMINI_API_KEY` (new key)
  - [ ] `VITE_GOOGLE_MAPS_API_KEY` (check if still valid)
  - [ ] `VITE_SUPABASE_URL` (should be fine)
  - [ ] `VITE_SUPABASE_ANON_KEY` (should be fine)
- [ ] **Test environment variable loading**:
  1. Start the development server: `npm run dev`
  2. Visit http://localhost:5179/verify-env.html
  3. Confirm all variables are loaded correctly

### 3. Backup Current Working Version
- [ ] **Create a backup branch**:
  ```
  git checkout -b backup-before-import
  git add .
  git commit -m "Backup before importing updated app from AI Studio"
  git push origin backup-before-import
  ```
- [ ] **Document current working state**:
  - Note any customizations or changes made
  - Document current functionality that works

### 4. Prepare Import Process
- [ ] **Review the import plan** in [IMPORT_PLAN.md](file:///Users/apcaballes/genieph/IMPORT_PLAN.md)
- [ ] **Download updated app from Google AI Studio**:
  - Ensure you have all files from the latest version
  - Check for any new dependencies or configuration requirements
- [ ] **Compare file structures**:
  - Identify new, modified, and deprecated files
  - Plan how to integrate changes without breaking existing functionality

### 5. Dependency Check
- [ ] **Check for new dependencies** in the updated app:
  - Compare package.json files
  - Install any new packages required
- [ ] **Update package-lock.json** if needed

## After Addressing Critical Issues

Once you've completed the above steps and verified that:
1. You have a new, valid Gemini API key
2. All environment variables are loading correctly
3. You have a backup of the current working version

Then you can proceed with importing the updated app using the detailed process in [IMPORT_PLAN.md](file:///Users/apcaballes/genieph/IMPORT_PLAN.md).

## Risk Mitigation

If you encounter issues during the import:
1. You can always revert to the backup branch
2. The current working API keys will be preserved
3. You can incrementally import changes rather than all at once