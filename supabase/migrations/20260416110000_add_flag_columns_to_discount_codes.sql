-- Add boolean flag columns to discount_codes that the newsletter and
-- signup-discount routes insert with, and discountService.ts reads from.
-- All have safe defaults so existing rows are unaffected.
-- Safe to run multiple times — IF NOT EXISTS prevents errors.

ALTER TABLE public.discount_codes
    ADD COLUMN IF NOT EXISTS free_delivery   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS one_per_user    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS new_users_only  BOOLEAN NOT NULL DEFAULT false;
