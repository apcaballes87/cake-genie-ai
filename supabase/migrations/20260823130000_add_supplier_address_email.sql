-- Add address and email columns to supplier signups
ALTER TABLE cakegenie_supplier_signups ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE cakegenie_supplier_signups ADD COLUMN IF NOT EXISTS email TEXT;
