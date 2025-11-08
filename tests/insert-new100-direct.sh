#!/bin/bash

# Get Supabase URL and keys from .env.local
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2)
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
ACCESS_TOKEN="sbp_7b1ab8b311077bb2ec388adf9d20a53a5479132a"

# Calculate expiration date (1 year from now)
EXPIRES_AT=$(date -u -v+1y +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+1 year" +"%Y-%m-%dT%H:%M:%S.000Z")

echo "Creating NEW100 discount code..."
echo "Supabase URL: $SUPABASE_URL"
echo "Expires at: $EXPIRES_AT"
echo ""

# Insert NEW100 code
curl -X POST "${SUPABASE_URL}/rest/v1/discount_codes" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "code": "NEW100",
    "discount_amount": 100,
    "discount_percentage": 0,
    "is_active": true,
    "max_uses": 1000,
    "times_used": 0,
    "expires_at": "'"${EXPIRES_AT}"'",
    "min_order_amount": 0,
    "reason": "New customer discount - ₱100 off"
  }'

echo ""
echo ""
echo "Verifying NEW100 was created..."

# Verify it was created
curl -s "${SUPABASE_URL}/rest/v1/discount_codes?code=eq.NEW100" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" | python3 -m json.tool

echo ""
echo "Done!"
