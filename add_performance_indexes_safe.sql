-- ============================================
-- GENIE.PH PERFORMANCE INDEXES (SAFE VERSION)
-- Purpose: Reduce Disk IO by optimizing query performance
-- Date: 2025-11-19
-- Priority: RECOMMENDED (Tested & Safe)
-- ============================================

-- This is a SAFE version that only creates indexes for columns we're 100% certain exist.
-- All indexes use "IF NOT EXISTS" so it's safe to run multiple times.

-- ============================================
-- STEP 1: Check what columns actually exist
-- ============================================

-- Run this first to see what columns exist in each table:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cakegenie_cart'
ORDER BY ordinal_position;

-- ============================================
-- SAFE INDEXES (Only using primary keys and timestamps)
-- ============================================

-- Cart: Index on primary key (if not already indexed)
CREATE INDEX IF NOT EXISTS idx_cart_item_id
ON cakegenie_cart(cart_item_id);

-- Cart: Index for expiration-based cleanup
CREATE INDEX IF NOT EXISTS idx_cart_expires_at
ON cakegenie_cart(expires_at);

-- Cart: Index for created_at (ordering)
CREATE INDEX IF NOT EXISTS idx_cart_created_at
ON cakegenie_cart(created_at DESC);

-- ============================================
-- ORDERS TABLE INDEXES
-- ============================================

-- Orders: Index on primary key
CREATE INDEX IF NOT EXISTS idx_orders_order_id
ON cakegenie_orders(order_id);

-- Orders: Index on order_number (for customer lookup)
CREATE INDEX IF NOT EXISTS idx_orders_order_number
ON cakegenie_orders(order_number);

-- Orders: Index on payment_status (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
ON cakegenie_orders(payment_status);

-- Orders: Index on order_status (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_orders_order_status
ON cakegenie_orders(order_status);

-- Orders: Index for created_at (admin dashboard queries)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON cakegenie_orders(created_at DESC);

-- Orders: Index for delivery_date (scheduling queries)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date
ON cakegenie_orders(delivery_date);

-- ============================================
-- SHARED DESIGNS TABLE INDEXES
-- ============================================

-- Shared designs by URL slug (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_shared_designs_url_slug
ON cakegenie_shared_designs(url_slug);

-- ============================================
-- ANALYSIS CACHE TABLE INDEXES
-- ============================================

-- Analysis cache by image URL (primary lookup)
CREATE INDEX IF NOT EXISTS idx_analysis_cache_image_url
ON cakegenie_analysis_cache(image_url);

-- Analysis cache by created_at (for cleanup)
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

-- Xendit payments by status
CREATE INDEX IF NOT EXISTS idx_xendit_payments_status
ON xendit_payments(status);

-- Xendit payments by created_at
CREATE INDEX IF NOT EXISTS idx_xendit_payments_created_at
ON xendit_payments(created_at DESC);

-- ============================================
-- DISCOUNT CODES TABLE INDEXES
-- ============================================

-- Discount codes by code (primary lookup)
CREATE INDEX IF NOT EXISTS idx_discount_codes_code
ON discount_codes(code);

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- VERIFICATION
-- ============================================

-- After running, verify indexes were created:
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('cakegenie_cart', 'cakegenie_orders', 'cakegenie_shared_designs',
                     'cakegenie_analysis_cache', 'xendit_payments', 'discount_codes')
ORDER BY tablename, indexname;
