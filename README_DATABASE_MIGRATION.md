# Database Migration Instructions

This document provides instructions for running the database migration to convert base64 URLs to proper Supabase Storage URLs.

## Overview

The migration script (`tests/fix-base64-urls.js`) identifies designs in the `cakegenie_shared_designs` table that have base64-encoded images in their `customized_image_url` field and converts them to proper Supabase Storage URLs.

## Prerequisites

1. Supabase service role key (NOT the anon key)
2. Node.js installed
3. Required npm packages installed (`@supabase/supabase-js`)

## How to Run

### Option 1: Using the helper script (recommended)

```bash
./run-fix-base64.sh your_service_role_key_here
```

### Option 2: Direct execution with environment variables

```bash
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here" node tests/fix-base64-urls.js
```

### Option 3: Using a .env file

Create a `.env` file in the project root with:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Then run:

```bash
node tests/fix-base64-urls.js
```

## What the Script Does

1. Connects to Supabase using the service role key
2. Queries the `cakegenie_shared_designs` table for records with base64 URLs
3. For each record:
   - Converts the base64 data to a binary buffer
   - Generates a filename based on the design ID
   - Uploads the file to the `shared-cake-images` storage bucket
   - Updates the database record with the public URL of the uploaded file

## Verification

After running the script, verify the migration was successful by running this SQL query in your Supabase SQL editor:

```sql
SELECT COUNT(*) FROM cakegenie_shared_designs WHERE customized_image_url LIKE 'data:image%';
```

This should return 0 if all base64 URLs have been successfully converted.

## Troubleshooting

### "Invalid API key" Error
Make sure you're using the service role key, not the anon key. The service role key can be found in your Supabase project settings under API.

### "Row-level security policy" Error
This indicates you're not using the service role key. The service role key bypasses RLS policies.

### "Upload failed" Error
Check that the `shared-cake-images` storage bucket exists and has the correct permissions.