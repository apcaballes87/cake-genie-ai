-- Migration: Create cakegenie_saved_items table
-- Run this in your Supabase SQL Editor

-- Create table for saved items (wishlist/favorites)
CREATE TABLE IF NOT EXISTS cakegenie_saved_items (
  saved_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- For catalog products
  product_id TEXT,
  product_name TEXT,
  product_price NUMERIC,
  product_image TEXT,
  
  -- For custom designs (links to analysis cache)
  analysis_p_hash TEXT,
  customization_snapshot JSONB,
  customized_image_url TEXT,
  
  -- Common fields
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'custom_design')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON cakegenie_saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_product_id ON cakegenie_saved_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_items_p_hash ON cakegenie_saved_items(analysis_p_hash) WHERE analysis_p_hash IS NOT NULL;

-- Create unique constraints to prevent duplicate saves
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_saved_product ON cakegenie_saved_items(user_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_saved_design ON cakegenie_saved_items(user_id, analysis_p_hash) WHERE analysis_p_hash IS NOT NULL;

-- Enable RLS
ALTER TABLE cakegenie_saved_items ENABLE ROW LEVEL SECURITY;

-- Policies (drop first if exist to avoid errors)
DROP POLICY IF EXISTS "Users can view their own saved items" ON cakegenie_saved_items;
DROP POLICY IF EXISTS "Users can insert their own saved items" ON cakegenie_saved_items;
DROP POLICY IF EXISTS "Users can delete their own saved items" ON cakegenie_saved_items;

CREATE POLICY "Users can view their own saved items" ON cakegenie_saved_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved items" ON cakegenie_saved_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved items" ON cakegenie_saved_items
  FOR DELETE USING (auth.uid() = user_id);
