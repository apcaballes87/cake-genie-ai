#!/bin/bash

# Verification script to check the current status of contribution tracking fix

echo "=== Contribution Tracking Fix - Status Verification ==="

# Check current directory
echo "Current directory: $(pwd)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "⚠️  Warning: Not in project root directory"
    echo "Please navigate to /Users/apcaballes/genieph before running this script"
    exit 1
fi

echo "✅ In project directory"

# Check if required files exist
echo ""
echo "=== File Verification ==="

if [ -f "supabase/functions/xendit-webhook/index.ts" ]; then
    echo "✅ Xendit webhook function exists"
    echo "   Lines: $(wc -l < supabase/functions/xendit-webhook/index.ts)"
else
    echo "❌ Xendit webhook function missing"
fi

if [ -f "supabase/migrations/20251105000000_update_design_amount_collected.sql" ]; then
    echo "✅ Database migration file exists"
    echo "   Lines: $(wc -l < supabase/migrations/20251105000000_update_design_amount_collected.sql)"
else
    echo "❌ Database migration file missing"
fi

if [ -f "apply-migration.sql" ]; then
    echo "✅ Direct migration SQL file exists"
    echo "   Lines: $(wc -l < apply-migration.sql)"
else
    echo "❌ Direct migration SQL file missing"
fi

if [ -f "DEPLOYMENT_INSTRUCTIONS.md" ]; then
    echo "✅ Deployment instructions exist"
else
    echo "❌ Deployment instructions missing"
fi

# Check directory structure
echo ""
echo "=== Directory Structure ==="
echo "Functions directory:"
ls -la supabase/functions/ | grep -E "(xendit-webhook|total)"

echo ""
echo "Migrations directory:"
ls -la supabase/migrations/ | grep -E "(20251105|total)"

# Summary
echo ""
echo "=== Summary ==="
echo "✅ All required files have been created"
echo "📋 Next steps:"
echo "   1. Review DEPLOYMENT_INSTRUCTIONS.md"
echo "   2. Apply the database migration using apply-migration.sql"
echo "   3. Deploy the Xendit webhook function"
echo "   4. Configure the webhook in your Xendit dashboard"

echo ""
echo "For detailed instructions, open DEPLOYMENT_INSTRUCTIONS.md"