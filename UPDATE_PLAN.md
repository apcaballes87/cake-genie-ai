# Update Plan: Migrating Genie.ph to New Bill-Sharing App

## Overview
This document outlines the step-by-step process to update the genie.ph website with the new app from the [apcaballes/genieph---bill-sharing](file:///Users/apcaballes/genieph---bill-sharing) folder while preserving the proper API key configuration and Vercel deployment setup.

## Key Differences Between Current and New App

### 1. Environment Variable Configuration
- **Current App**: Uses `import.meta.env.VITE_GEMINI_API_KEY` with Vite
- **New App**: Uses `process.env.API_KEY` with a different approach

### 2. Package.json Structure
- **Current App**: Full Vite/React setup with development and build scripts
- **New App**: Simplified setup with only basic serving capabilities

### 3. API Key Management
- **Current App**: Proper Vercel environment variable integration
- **New App**: Uses [.env.local](file:///Users/apcaballes/genieph---bill-sharing/.env.local) with placeholder

## Migration Steps

### Phase 1: Backup Current Implementation
1. Create a backup branch of the current genie.ph implementation
2. Document current environment variable setup
3. Document current Vercel deployment configuration

### Phase 2: Analyze New App Structure
1. Identify new features and components in the bill-sharing app
2. Map out file structure differences
3. Identify any breaking changes or deprecated features

### Phase 3: Preserve Critical Configuration
1. Maintain Vercel environment variable setup (`VITE_GEMINI_API_KEY`)
2. Preserve Supabase configuration
3. Keep Google Maps API key integration
4. Maintain existing npm scripts and build process

### Phase 4: Selective File Migration
1. Update core application files (App.tsx, index.html, etc.)
2. Migrate new components and features
3. Integrate new services while preserving API key handling
4. Update configuration files to maintain Vercel compatibility

### Phase 5: Testing and Validation
1. Test local development environment
2. Verify API key integration works correctly
3. Test all new features from the bill-sharing app
4. Validate Vercel deployment process

### Phase 6: Deployment
1. Deploy to Vercel staging environment
2. Perform final testing
3. Deploy to production

## Detailed Implementation Steps

### 1. Environment Variable Integration
The new app uses `process.env.API_KEY` but we need to maintain `import.meta.env.VITE_GEMINI_API_KEY` for Vercel compatibility.

We'll need to:
- Update [config.ts](file:///Users/apcaballes/genieph/config.ts) to use the Vite approach
- Modify [geminiService.ts](file:///Users/apcaballes/genieph/services/geminiService.ts) to use `import.meta.env.VITE_GEMINI_API_KEY`
- Ensure environment variables work in both local development and Vercel deployment

### 2. Package.json Updates
We need to preserve the current package.json structure to maintain:
- Vite build process
- Development server (`npm run dev`)
- TypeScript compilation
- All existing dependencies

### 3. File Migration Strategy
We'll migrate files selectively:
- Core files (App.tsx, index.html, config.ts) - update with new content
- Components - merge new components with existing ones
- Services - update geminiService to maintain Vercel compatibility
- Configuration files - preserve Vercel deployment settings

## Risk Mitigation

1. **Backup Strategy**: Create a complete backup before starting migration
2. **Incremental Testing**: Test after each phase to catch issues early
3. **Rollback Plan**: Document steps to revert to current implementation if needed
4. **Environment Variable Verification**: Double-check API key configuration works

## Verification Checklist

- [ ] Local development server runs correctly
- [ ] Vercel environment variables are properly configured
- [ ] Gemini API integration works
- [ ] Google Maps integration works
- [ ] Supabase integration works
- [ ] All new bill-sharing features are functional
- [ ] Application builds successfully for production
- [ ] Vercel deployment works correctly