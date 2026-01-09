-- ============================================
-- GENIE.PH PERFORMANCE INDEXES
-- Purpose: Reduce Disk IO by optimizing query performance
-- Date: 2025-11-19
-- Priority: RECOMMENDED (Safe to run)
-- ============================================

-- This script adds essential indexes to reduce disk IO and improve query performance.
-- All indexes use "IF NOT EXISTS" so it's safe to run multiple times.
-- Run this script in your Supabase SQL Editor.

-- ============================================
-- CART TABLE INDEXES
-- ============================================

-- Cart queries by user_id (frequently accessed for logged-in users)
CREATE INDEX IF NOT EXISTS idx_cart_user_id
ON cakegenie_cart(user_id)
WHERE user_id IS NOT NULL;

-- Cart queries by session_id (for anonymous users)
CREATE INDEX IF NOT EXISTS idx_cart_session_id
ON cakegenie_cart(session_id)
WHERE session_id IS NOT NULL;

-- Index for expired cart cleanup operations
CREATE INDEX IF NOT EXISTS idx_cart_expires_at
ON cakegenie_cart(expires_at);

-- Covering index for cart display queries (includes commonly selected columns)
CREATE INDEX IF NOT EXISTS idx_cart_user_display
ON cakegenie_cart(user_id, created_at DESC)
INCLUDE (cart_item_id, customized_image_url, quantity, final_price)
WHERE user_id IS NOT NULL;

-- Index for RLS auth checks
CREATE INDEX IF NOT EXISTS idx_cart_user_auth
ON cakegenie_cart(user_id, session_id);

-- ============================================
-- ORDERS TABLE INDEXES
-- ============================================

-- Orders by user (customer order history)
CREATE INDEX IF NOT EXISTS idx_orders_user_id
ON cakegenie_orders(user_id);

-- Orders by payment status (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
ON cakegenie_orders(payment_status);

-- Orders by creation date for admin dashboard (DESC for recent-first queries)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON cakegenie_orders(created_at DESC);

-- Orders by order_id (primary lookup)
CREATE INDEX IF NOT EXISTS idx_orders_order_id
ON cakegenie_orders(order_id);

-- Partial index for active orders only (smaller, faster)
CREATE INDEX IF NOT EXISTS idx_orders_active
ON cakegenie_orders(user_id, created_at DESC)
WHERE payment_status IN ('pending', 'processing');

-- ============================================
-- SHARED DESIGNS TABLE INDEXES
-- ============================================

-- Shared designs by URL slug (primary access pattern for share links)
CREATE INDEX IF NOT EXISTS idx_shared_designs_url_slug
ON cakegenie_shared_designs(url_slug);

-- Shared designs by user for user galleries
CREATE INDEX IF NOT EXISTS idx_shared_designs_user_id
ON cakegenie_shared_designs(user_id);

-- ============================================
-- ANALYSIS CACHE TABLE INDEXES
-- ============================================

-- Analysis cache by image URL (primary lookup)
CREATE INDEX IF NOT EXISTS idx_analysis_cache_image_url
ON cakegenie_analysis_cache(image_url);

-- Analysis cache cleanup by timestamp
CREATE INDEX IF NOT EXISTS idx_analysis_cache_created_at
ON cakegenie_analysis_cache(created_at);

-- ============================================
-- PAYMENT TABLES INDEXES
-- ============================================

-- Xendit payments by order_id
CREATE INDEX IF NOT EXISTS idx_xendit_payments_order_id
ON xendit_payments(order_id);

-- Xendit payments by invoice_id (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_xendit_payments_invoice_id
ON xendit_payments(invoice_id);

-- Xendit payments by status for reconciliation
CREATE INDEX IF NOT EXISTS idx_xendit_payments_status
ON xendit_payments(status);

-- Composite index for payment verification queries
CREATE INDEX IF NOT EXISTS idx_xendit_payments_order_status
ON xendit_payments(order_id, status, created_at DESC);

-- ============================================
-- DISCOUNT CODES TABLE INDEXES
-- ============================================

-- Discount codes by code (primary lookup) - partial index for active codes only
CREATE INDEX IF NOT EXISTS idx_discount_codes_code
ON discount_codes(code)
WHERE is_active = true;

-- Discount codes by expiry for cleanup
CREATE INDEX IF NOT EXISTS idx_discount_codes_expiry
ON discount_codes(end_date)
WHERE is_active = true;

-- ============================================
-- ADDRESSES TABLE INDEXES
-- ============================================

-- Addresses by user
CREATE INDEX IF NOT EXISTS idx_addresses_user_id
ON cakegenie_addresses(user_id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these queries after creating indexes to verify they were created:

-- Check all indexes on cart table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cakegenie_cart' ORDER BY indexname;

-- Check all indexes on orders table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'cakegenie_orders' ORDER BY indexname;

-- Check index usage statistics (run after a few hours of traffic)
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query to find slowest queries (run periodically to identify bottlenecks)
-- SELECT
--   query,
--   calls,
--   total_exec_time,
--   mean_exec_time,
--   max_exec_time,
--   stddev_exec_time
-- FROM pg_stat_statements
-- WHERE mean_exec_time > 1000 -- Queries taking more than 1 second on average
-- ORDER BY mean_exec_time DESC
-- LIMIT 20;

-- ============================================
-- CACHE HIT RATE MONITORING
-- ============================================

-- Check cache hit rate (target: >95%)
-- SELECT
--   sum(heap_blks_read) as heap_read,
--   sum(heap_blks_hit) as heap_hit,
--   CASE
--     WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
--     ELSE round((sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)))::numeric * 100, 2)
--   END as cache_hit_ratio_percent
-- FROM pg_statio_user_tables;

-- ============================================
-- COMPLETION
-- ============================================

-- After running this script:
-- 1. Verify indexes were created (run verification queries above)
-- 2. Monitor cache hit rate over the next 24 hours
-- 3. Check for slow queries using pg_stat_statements
-- 4. Review Disk IO metrics in Supabase Dashboard
-- 5. Proceed to next optimization steps in DISK_IO_OPTIMIZATION_PLAN.md

COMMENT ON EXTENSION pg_stat_statements IS 'Performance monitoring extension for tracking query statistics';
