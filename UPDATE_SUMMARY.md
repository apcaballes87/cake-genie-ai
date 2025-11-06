# Update Summary: Genie.ph with Bill-Sharing App

## Current Status
You want to update the genie.ph website with the new app from the [apcaballes/genieph---bill-sharing](file:///Users/apcaballes/genieph---bill-sharing) folder. This new app includes bill-sharing functionality and other enhancements.

## Key Differences

### Environment Variable Handling
- **Current App**: Uses `import.meta.env.VITE_GEMINI_API_KEY` (Vercel compatible)
- **New App**: Uses `process.env.API_KEY` (different approach)

### Package Management
- **Current App**: Full Vite/React setup with build and development scripts
- **New App**: Simplified setup with basic serving capabilities

### New Features
The bill-sharing app includes:
- Bill sharing functionality for collaborative cake ordering
- Discount code system with automatic generation
- Enhanced sharing capabilities with additional metadata
- Incentive program for contributors

## Migration Approach

### 1. Preserve Vercel Compatibility
We must maintain the current environment variable setup:
- Keep using `import.meta.env.VITE_GEMINI_API_KEY`
- Preserve Vercel deployment configuration
- Maintain existing npm scripts and build process

### 2. Selective Feature Integration
We'll selectively integrate new features:
- Add bill-sharing functionality
- Incorporate discount code system
- Enhance sharing capabilities
- Add incentive program features

### 3. Maintain Existing Functionality
All current features must continue to work:
- Gemini API integration
- Google Maps integration
- Supabase integration
- Existing UI components

## Implementation Steps

### Phase 1: Preparation
1. Create backup of current implementation
2. Document current environment variables
3. Analyze new features in bill-sharing app

### Phase 2: Environment Variable Integration
1. Update config.ts to maintain Vercel compatibility
2. Modify geminiService.ts to use proper environment variables
3. Ensure all services use consistent API key handling

### Phase 3: Feature Migration
1. Add new services (discountService, incentiveService, enhanced shareService)
2. Update UI components for bill sharing
3. Integrate new database schema requirements

### Phase 4: Testing
1. Test local development environment
2. Verify API key integration
3. Test all new features
4. Validate Vercel deployment

### Phase 5: Deployment
1. Deploy to Vercel staging
2. Perform final testing
3. Deploy to production

## Important Considerations

### API Key Management
The current app has a known issue with the API key being reported as leaked. Before migration:
1. Generate a new Gemini API key
2. Update Vercel environment variables
3. Redeploy current app to verify it works
4. Then proceed with migration

### Database Updates
The new features may require database schema updates:
- New discount codes table
- Enhanced shared designs table
- Additional Supabase functions

## Success Criteria
- Application builds and deploys successfully to Vercel
- All existing functionality is preserved
- New bill-sharing features work correctly
- API key integration works in both local and production environments
- No breaking changes to user experience

## Next Steps
1. Review the detailed documentation:
   - [UPDATE_PLAN.md](file:///Users/apcaballes/genieph/UPDATE_PLAN.md) - Comprehensive migration plan
   - [EXECUTION_STEPS.md](file:///Users/apcaballes/genieph/EXECUTION_STEPS.md) - Step-by-step execution guide
   - [MIGRATION_CHECKLIST.md](file:///Users/apcaballes/genieph/MIGRATION_CHECKLIST.md) - Detailed checklist
   - [BILL_SHARING_FEATURES.md](file:///Users/apcaballes/genieph/BILL_SHARING_FEATURES.md) - New features overview

2. Fix the current API key issue (if not already done)
3. Begin migration following the documented approach