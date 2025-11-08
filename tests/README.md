# Test Scripts

This directory contains various test scripts for development and debugging purposes.

## Discount Code Scripts

### create-test-discount-codes.js
Creates test discount codes in the database for development testing.

**Usage:**
```bash
node create-test-discount-codes.js
```

**Prerequisites:**
- Set the following environment variables:
  - `VITE_SUPABASE_URL` - Your Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

To get your Supabase service role key:
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Find the "service_role" key under "Project API keys"
4. Copy this key (it's different from the anon key)

If using a .env file, add:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Created Codes:**
- WELCOME50: ₱50 off
- PERCENT20: 20% off with minimum order of ₱500
- TEST100: ₱100 off (for general testing)
- HOLIDAY25: 25% off with minimum order of ₱1000
- EXPIRED: Expired code for testing validation
- INACTIVE: Inactive code for testing validation

### verify-discount-codes.js
Verifies that test discount codes were created properly.

**Usage:**
```bash
node verify-discount-codes.js
```

### test-discount-validation.js
Tests the discount code validation function.

**Usage:**
```bash
node test-discount-validation.js
```

### debug-discount-validation.js
Debug version of the discount validation test with more detailed output.

**Usage:**
```bash
node debug-discount-validation.js
```

## E2E Testing
For complete end-to-end testing, follow the steps in [E2E_TEST_PLAN.md](E2E_TEST_PLAN.md)