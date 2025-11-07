#!/bin/bash

# Deployment script for Xendit webhook and database function
# This script deploys the fix for contribution tracking issues

echo "🚀 Starting deployment of contribution tracking fix..."

# Navigate to project directory
cd /Users/apcaballes/genieph

echo "📁 Current directory: $(pwd)"

# Check if Supabase CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available"
    exit 1
fi

echo "✅ Supabase CLI is available"

# 1. Apply database migration
echo "🔧 Applying database migration..."
npx supabase migration up

if [ $? -eq 0 ]; then
    echo "✅ Database migration applied successfully"
else
    echo "⚠️  Warning: Database migration may have failed or there were no migrations to apply"
fi

# 2. Deploy the Xendit webhook function
echo "☁️  Deploying Xendit webhook function..."
npx supabase functions deploy xendit-webhook

if [ $? -eq 0 ]; then
    echo "✅ Xendit webhook function deployed successfully"
else
    echo "❌ Error: Failed to deploy Xendit webhook function"
    exit 1
fi

# 3. List deployed functions to verify
echo "📋 Checking deployed functions..."
npx supabase functions list

echo "🎉 Deployment completed!"

echo "📋 Next steps:"
echo "1. Configure Xendit webhook in your Xendit dashboard:"
echo "   URL: https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/xendit-webhook"
echo "   Event: invoice.paid"
echo "2. Test by making a contribution and completing the payment"
echo "3. Refresh the shared design page to see the updated amount collected"