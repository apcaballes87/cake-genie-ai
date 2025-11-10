#!/bin/bash

# Deploy the share-design Supabase function
# This function serves Open Graph meta tags for social media sharing
echo "🚀 Deploying share-design function to Supabase..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

# Check if we're linked to a project
if [ ! -f ".supabase/config.toml" ] && [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not linked to a Supabase project. Run:"
    echo "   supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

# Deploy the function
echo "📦 Deploying share-design function..."
supabase functions deploy share-design --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
    echo ""
    echo "🔗 Test it at:"
    echo "   https://YOUR_PROJECT_REF.supabase.co/functions/v1/share-design/your-design-slug"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Test the URL above in your browser"
    echo "   2. Test Facebook sharing with: https://developers.facebook.com/tools/debug/"
    echo "   3. Paste your genie.ph/designs/... URL in the debugger"
else
    echo "❌ Deployment failed. Check the error above."
    exit 1
fi