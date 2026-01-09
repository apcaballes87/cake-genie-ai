-- ============================================
-- Cart Performance Optimization: Add Indexes
-- ============================================
-- Run this in Supabase SQL Editor to fix slow queries

-- 1. Add index on session_id (for anonymous users)
CREATE INDEX IF NOT EXISTS idx_cakegenie_cart_session_id
ON cakegenie_cart(session_id)
WHERE session_id IS NOT NULL;

-- 2. Add index on user_id (for authenticated users)
CREATE INDEX IF NOT EXISTS idx_cakegenie_cart_user_id
ON cakegenie_cart(user_id)
WHERE user_id IS NOT NULL;

-- 3. Add index on expires_at (for filtering expired items)
CREATE INDEX IF NOT EXISTS idx_cakegenie_cart_expires_at
ON cakegenie_cart(expires_at);

-- 4. Add composite index for the most common query pattern
-- (session_id + expires_at together - even faster!)
CREATE INDEX IF NOT EXISTS idx_cakegenie_cart_session_expires
ON cakegenie_cart(session_id, expires_at)
WHERE session_id IS NOT NULL;

-- 5. Add composite index for authenticated users
CREATE INDEX IF NOT EXISTS idx_cakegenie_cart_user_expires
ON cakegenie_cart(user_id, expires_at)
WHERE user_id IS NOT NULL;

-- 6. Add index on addresses user_id
CREATE INDEX IF NOT EXISTS idx_cakegenie_addresses_user_id
ON cakegenie_addresses(user_id)
WHERE user_id IS NOT NULL;

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('cakegenie_cart', 'cakegenie_addresses')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Check index sizes (to monitor disk usage)
SELECT
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname IN ('cakegenie_cart', 'cakegenie_addresses')
ORDER BY relname, indexrelname;
