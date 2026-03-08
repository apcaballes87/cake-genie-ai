-- Add optional design showcase fields to existing blogs table
-- Run this in Supabase SQL Editor for existing projects.

ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS design_showcases JSONB,
  ADD COLUMN IF NOT EXISTS design_showcase_keywords TEXT,
  ADD COLUMN IF NOT EXISTS design_showcase_title TEXT,
  ADD COLUMN IF NOT EXISTS design_showcase_intro TEXT;

CREATE INDEX IF NOT EXISTS idx_blogs_design_showcase_keywords
  ON blogs(design_showcase_keywords);