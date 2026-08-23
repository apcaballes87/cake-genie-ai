-- Add profile and cover photo URL columns to supplier signups
ALTER TABLE cakegenie_supplier_signups
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
