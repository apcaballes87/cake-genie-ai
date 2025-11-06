# Bill Sharing Features in New App

## Overview
The new app in the [apcaballes/genieph---bill-sharing](file:///Users/apcaballes/genieph---bill-sharing) folder includes several new features focused on bill sharing and collaborative cake ordering.

## Key New Features

### 1. Bill Sharing Functionality
- Users can enable bill sharing for their cake designs
- Allows multiple people to contribute to the cost of a cake
- Generates unique discount codes for contributors
- Tracks contributions through Supabase

### 2. Discount Code System
- Automatic generation of discount codes for contributors
- Validation of discount codes during checkout
- Management of discount code expiration and usage

### 3. Enhanced Sharing Capabilities
- Improved design sharing with more metadata
- Better URL slugs for shared designs
- Additional fields for delivery information and event details

### 4. Incentive Program
- Automatic generation of FRIEND discount codes for contributors
- Integration with the discount system

## Technical Components

### New Services
1. **discountService.ts** - Handles discount code validation and management
2. **incentiveService.ts** - Generates contributor discount codes
3. **shareService.ts** - Enhanced sharing functionality with bill sharing support

### Updated Features
1. **Enhanced Shared Design Data** - Additional fields for delivery and event information
2. **Bill Contribution Tracking** - Database schema for tracking contributions
3. **Improved URL Generation** - Better slugs for shared designs

## Integration Considerations

### Environment Variables
The new app uses a different approach to environment variables:
- Current app: `import.meta.env.VITE_GEMINI_API_KEY`
- New app: `process.env.API_KEY`

We need to maintain the Vercel-compatible approach while incorporating new features.

### Supabase Integration
The new features require additional Supabase tables and functions:
- Discount codes table
- Enhanced shared designs table with new fields
- New Supabase functions for discount validation

### API Integration
The new app maintains the Gemini API integration but may have enhanced prompts or functionality.

## Migration Impact

### Breaking Changes
- Environment variable handling needs to be updated
- New database tables may be required
- Some UI components may need updates

### Backward Compatibility
- Existing shared designs should continue to work
- Current API key integration must be preserved
- Vercel deployment process should remain unchanged

## Implementation Plan

1. Preserve existing Vercel environment variable setup
2. Incorporate new services while maintaining API key compatibility
3. Update database schema if needed
4. Integrate new UI components for bill sharing
5. Test all functionality in both local and Vercel environments