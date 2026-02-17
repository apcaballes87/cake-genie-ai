-- Insert product sizes into productsizes_cakegenie table
-- Run this in Supabase SQL Editor

INSERT INTO productsizes_cakegenie (cakesize, price, type, thickness, display_order)
VALUES 
  ('8x8', 1499, 'Square', '4 in', 999),
  ('10x10', 1799, 'Square', '4 in', 999)
RETURNING *;
