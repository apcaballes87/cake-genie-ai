#!/bin/bash

# Verification script to check if contribution tracking fix files are in place

echo "🔍 Verifying contribution tracking fix deployment..."

# Navigate to project directory
cd /Users/apcaballes/genieph

echo "📁 Current directory: $(pwd)"

# Check if xendit-webhook function exists
if [ -f "supabase/functions/xendit-webhook/index.ts" ]; then
    echo "✅ Xendit webhook function exists"
    echo "📄 Function file size: $(wc -l < supabase/functions/xendit-webhook/index.ts) lines"
else
    echo "❌ Xendit webhook function is missing"
fi

# Check if migration file exists
if [ -f "supabase/migrations/20251105000000_update_design_amount_collected.sql" ]; then
    echo "✅ Database migration file exists"
    echo "📄 Migration file size: $(wc -l < supabase/migrations/20251105000000_update_design_amount_collected.sql) lines"
else
    echo "❌ Database migration file is missing"
fi

# List functions directory
echo "📂 Functions directory contents:"
ls -la supabase/functions/

# List migrations directory
echo "📂 Migrations directory contents:"
ls -la supabase/migrations/

echo "✅ Verification complete"