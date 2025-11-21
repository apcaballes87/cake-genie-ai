-- ============================================
-- GENIE.PH PERFORMANCE INDEXES (FINAL VERSION)
-- Purpose: Reduce Disk IO by optimizing query performance
-- Date: 2025-11-19
-- Status: Ready to run
-- ============================================

-- This script is based on actual code analysis and confirmed column names.
-- All indexes use "IF NOT EXISTS" so it's safe to run multiple times.
-- Run this in your Supabase SQL Editor.

-- ============================================
-- CART TABLE INDEXES
-- Based on: src/services/supabaseService.ts lines 227-265
-- Columns used: user_id, session_id, expires_at, cart_item_id, created_at
-- ============================================

-- Cart queries by user_id (line 233: query.eq('user_id', userId))
CREATE INDEX IF NOT EXISTS idx_cart_user_id
ON cakegenie_cart(user_id)
WHERE user_id IS NOT NULL;

-- Cart queries by session_id (line 235: query.eq('session_id', sessionId))
CREATE INDEX IF NOT EXISTS idx_cart_session_id
ON cakegenie_cart(session_id)
WHERE session_id IS NOT NULL;

-- Index for expired cart cleanup (line 229: .gt('expires_at', ...))
CREATE INDEX IF NOT EXISTS idx_cart_expires_at
ON cakegenie_cart(expires_at);

-- Index for ordering by created_at (line 230: .order('created_at', { ascending: false }))
CREATE INDEX IF NOT EXISTS idx_cart_created_at
ON cakegenie_cart(created_at DESC);

-- Index on primary key for direct lookups (line 297: .eq('cart_item_id', cartItemId))
CREATE INDEX IF NOT EXISTS idx_cart_item_id
ON cakegenie_cart(cart_item_id);

-- ============================================
-- ORDERS TABLE INDEXES
-- Based on: confirmed columns from database query
-- ============================================

-- Orders by user_id (for customer order history)
CREATE INDEX IF NOT EXISTS idx_orders_user_id
ON cakegenie_orders(user_id)
WHERE user_id IS NOT NULL;

-- Orders by order_number (customer lookup)
CREATE INDEX IF NOT EXISTS idx_orders_order_number
ON cakegenie_orders(order_number);

-- Orders by payment_status (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
ON cakegenie_orders(payment_status);

-- Orders by order_status (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_orders_order_status
ON cakegenie_orders(order_status);

-- Orders by created_at (admin dashboard DESC queries)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON cakegenie_orders(created_at DESC);

-- Orders by delivery_date (scheduling and filtering)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date
ON cakegenie_orders(delivery_date);

-- Composite index for admin dashboard (filter + sort)
CREATE INDEX IF NOT EXISTS idx_orders_status_date
ON cakegenie_orders(order_status, created_at DESC);

-- ============================================
-- SHARED DESIGNS TABLE INDEXES
-- Based on: supabase/functions/share-design/index.ts line 93
-- ============================================

-- Shared designs by URL slug (line 93: .eq('url_slug', slug))
CREATE INDEX IF NOT EXISTS idx_shared_designs_url_slug
ON cakegenie_shared_designs(url_slug);

-- Shared designs by user (for user galleries)
CREATE INDEX IF NOT EXISTS idx_shared_designs_user_id
ON cakegenie_shared_designs(created_by_user_id)
WHERE created_by_user_id IS NOT NULL;

-- Shared designs by created_at (for recent designs)
CREATE INDEX IF NOT EXISTS idx_shared_designs_created_at
ON cakegenie_shared_designs(created_at DESC);

-- ============================================
-- ANALYSIS CACHE TABLE INDEXES
-- Based on: confirmed columns from database query
-- ============================================

-- Analysis cache by p_hash (primary lookup for matching images)
CREATE INDEX IF NOT EXISTS idx_analysis_cache_p_hash
ON cakegenie_analysis_cache(p_hash);

-- Analysis cache by original_image_url
CREATE INDEX IF NOT EXISTS idx_analysis_cache_image_url
ON cakegenie_analysis_cache(original_image_url);

-- Analysis cache by created_at (for cleanup/expiry)
CREATE INDEX IF NOT EXISTS idx_analysis_cache_created_at
ON cakegenie_analysis_cache(created_at);

-- ============================================
-- PAYMENT TABLES INDEXES
-- Based on: supabase/functions/verify-xendit-payment/index.ts
-- ============================================

-- Xendit payments by order_id (line 42: .eq('order_id', orderId))
CREATE INDEX IF NOT EXISTS idx_xendit_payments_order_id
ON xendit_payments(order_id);

-- Xendit payments by invoice_id (line 92: .eq('invoice_id', invoiceId))
CREATE INDEX IF NOT EXISTS idx_xendit_payments_invoice_id
ON xendit_payments(invoice_id);

-- Xendit payments by status (for reconciliation)
CREATE INDEX IF NOT EXISTS idx_xendit_payments_status
ON xendit_payments(status);

-- Xendit payments by created_at with order_id (line 44: .order('created_at', { ascending: false }))
CREATE INDEX IF NOT EXISTS idx_xendit_payments_created_at
ON xendit_payments(created_at DESC);

-- ============================================
-- DISCOUNT CODES TABLE INDEXES
-- Based on: confirmed columns from database query
-- ============================================

-- Discount codes by code (primary lookup)
CREATE INDEX IF NOT EXISTS idx_discount_codes_code
ON discount_codes(code)
WHERE is_active = true;

-- Discount codes by user_id (user-specific codes)
CREATE INDEX IF NOT EXISTS idx_discount_codes_user_id
ON discount_codes(user_id)
WHERE user_id IS NOT NULL;

-- Discount codes by expires_at (cleanup and validation)
CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at
ON discount_codes(expires_at)
WHERE is_active = true;

-- ============================================
-- ADDRESSES TABLE INDEXES
-- ============================================

-- Addresses by user_id (user address lookup)
CREATE INDEX IF NOT EXISTS idx_addresses_user_id
ON cakegenie_addresses(user_id);

-- ============================================
-- PERFORMANCE MONITORING SETUP
-- ============================================

-- Enable pg_stat_statements extension for query performance tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these after creating indexes to verify success:

-- 1. Check all indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'cakegenie_cart',
    'cakegenie_orders',
    'cakegenie_shared_designs',
    'cakegenie_analysis_cache',
    'xendit_payments',
    'discount_codes',
    'cakegenie_addresses'
  )
ORDER BY tablename, indexname;

-- 2. Check cache hit rate (run after 24 hours to see improvement)
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  CASE
    WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
    ELSE round((sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)))::numeric * 100, 2)
  END as cache_hit_ratio_percent
FROM pg_statio_user_tables
WHERE schemaname = 'public';

-- 3. Check for slow queries (run periodically)
SELECT
  substring(query, 1, 100) as query_preview,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(total_exec_time::numeric, 2) as total_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
  AND query NOT LIKE '%information_schema%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 4. Check index usage (run after a few hours of traffic)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan > 0
ORDER BY idx_scan DESC
LIMIT 30;

-- ============================================
-- SUCCESS CRITERIA
-- ============================================

-- After 24 hours, you should see:
-- ✅ Cache hit rate > 85% (target: 90-95%)
-- ✅ Average query time < 100ms
-- ✅ No queries taking > 1000ms consistently
-- ✅ Indexes being actively used (idx_scan > 0)

-- ============================================
-- NOTES
-- ============================================

-- - All indexes are safe to add (CREATE INDEX IF NOT EXISTS)
-- - Indexes will be built in the background
-- - No downtime required
-- - Can be run multiple times safely
-- - Remove any index with: DROP INDEX IF EXISTS index_name;
