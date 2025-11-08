#!/bin/bash

# Script to run the base64 URL fix with proper Supabase credentials
# Usage: ./run-fix-base64.sh [service_role_key] [supabase_url]

SERVICE_ROLE_KEY=${1:-""}
SUPABASE_URL=${2:-"https://cqmhanqnfybyxezhobkx.supabase.co"}

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "Error: Service role key is required"
    echo "Usage: ./run-fix-base64.sh <service_role_key> [supabase_url]"
    exit 1
fi

echo "Running base64 URL fix with:"
echo "  Supabase URL: $SUPABASE_URL"
echo "  Service Role Key: ${SERVICE_ROLE_KEY:0:10}...${SERVICE_ROLE_KEY: -5}"  # Show only parts of the key for security

# Run the script with the provided credentials
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_URL="$SUPABASE_URL" node tests/fix-base64-urls.js