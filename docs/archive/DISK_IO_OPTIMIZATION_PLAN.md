# Disk IO Optimization Plan for Genie.ph
**Date:** 2025-11-19
**Status:** URGENT - Disk IO Budget Depletion
**Priority:** Critical

## Executive Summary

Genie.ph has received a warning from Supabase regarding high Disk IO consumption that's depleting the disk budget. This document outlines a comprehensive plan to optimize database queries, implement caching strategies, add missing indexes, and reduce overall disk IO operations.

---

## Table of Contents

1. [Current Situation Analysis](#current-situation-analysis)
2. [Immediate Quick Wins (0-24 hours)](#immediate-quick-wins-0-24-hours)
3. [Short-term Optimizations (1-7 days)](#short-term-optimizations-1-7-days)
4. [Medium-term Improvements (1-4 weeks)](#medium-term-improvements-1-4-weeks)
5. [Long-term Strategy (1-3 months)](#long-term-strategy-1-3-months)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Implementation Checklist](#implementation-checklist)

---

## Current Situation Analysis

### Root Causes Identified (from Supabase Guide)

1. **High Memory Usage** → Causing disk swapping
2. **Low Cache Hit Rate** → Forcing frequent disk access
3. **Poor Query Performance** → Queries taking >1 second
4. **High Traffic Volume** → Amplifying the above issues

### Current Application Architecture

**Database Tables:**
- `cakegenie_cart` - Shopping cart operations
- `cakegenie_orders` - Order management
- `cakegenie_addresses` - Customer addresses
- `cakegenie_analysis_cache` - AI analysis results cache
- `cakegenie_shared_designs` - Shared cake designs
- `productsizes_cakegenie` - Product size pricing
- `pricing_rules` - Dynamic pricing rules
- `xendit_payments` - Payment tracking
- `discount_codes` - Discount code validation

**Edge Functions (7 total):**
- `share-design` - Social sharing with OG tags
- `verify-xendit-payment` - Payment verification
- `create-bux-payment` - Payment creation
- `bux-webhook` - Payment webhook handler
- `verify-contribution-payment` - Contribution verification
- `validate-discount-code` - Discount validation
- `generate-sitemap` - SEO sitemap generation

**Current Optimizations:**
✅ Pricing rules cache (5-minute in-memory cache in `pricingService.database.ts`)
✅ Analysis cache table (`cakegenie_analysis_cache`)
✅ Share-design Edge Function has cache headers (`Cache-Control: public, max-age=3600, s-maxage=86400`)

---

## Immediate Quick Wins (0-24 hours)

### 1. Add Missing Database Indexes

**Priority: CRITICAL**

Based on query patterns in the codebase, these indexes are essential:

#### Cart Table Indexes
```sql
-- Cart queries by user_id (frequently accessed)
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cakegenie_cart(user_id) WHERE deleted_at IS NULL;

-- Cart queries by session_id (for anonymous users)
CREATE INDEX IF NOT EXISTS idx_cart_session_id ON cakegenie_cart(session_id) WHERE deleted_at IS NULL;

-- Composite index for cart cleanup operations
CREATE INDEX IF NOT EXISTS idx_cart_updated_deleted ON cakegenie_cart(updated_at, deleted_at);
```

#### Orders Table Indexes
```sql
-- Orders by user (customer order history)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON cakegenie_orders(user_id);

-- Orders by payment status (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON cakegenie_orders(payment_status);

-- Orders by creation date for admin dashboard
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON cakegenie_orders(created_at DESC);

-- Orders by order_id (primary lookup)
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON cakegenie_orders(order_id);
```

#### Shared Designs Table Indexes
```sql
-- Shared designs by URL slug (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_shared_designs_url_slug ON cakegenie_shared_designs(url_slug);

-- Shared designs by user for user galleries
CREATE INDEX IF NOT EXISTS idx_shared_designs_user_id ON cakegenie_shared_designs(user_id);
```

#### Analysis Cache Indexes
```sql
-- Analysis cache by image URL (primary lookup)
CREATE INDEX IF NOT EXISTS idx_analysis_cache_image_url ON cakegenie_analysis_cache(image_url);

-- Analysis cache cleanup by timestamp
CREATE INDEX IF NOT EXISTS idx_analysis_cache_created_at ON cakegenie_analysis_cache(created_at);
```

#### Payment Tables Indexes
```sql
-- Xendit payments by order_id
CREATE INDEX IF NOT EXISTS idx_xendit_payments_order_id ON xendit_payments(order_id);

-- Xendit payments by invoice_id (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_xendit_payments_invoice_id ON xendit_payments(invoice_id);

-- Xendit payments by status for reconciliation
CREATE INDEX IF NOT EXISTS idx_xendit_payments_status ON xendit_payments(status);

-- Discount codes by code (primary lookup)
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code) WHERE is_active = true;
```

**Implementation File:** Create `supabase/migrations/add_performance_indexes.sql`

### 2. Enable Query Result Caching

**Priority: HIGH**

Extend the existing caching pattern to more service operations:

#### A. Cache Discount Code Validations (5 minutes)
```typescript
// In validateDiscountCode function
let discountCodeCache: Map<string, { code: any; timestamp: number }> | null = null;
const DISCOUNT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

#### B. Cache Product Sizes (10 minutes)
```typescript
// In getProductSizes function
let productSizesCache: { sizes: any[]; timestamp: number } | null = null;
const PRODUCT_SIZES_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
```

#### C. Cache User Orders List (2 minutes)
```typescript
// In getUserOrders function - cache per user
const userOrdersCache = new Map<string, { orders: any[]; timestamp: number }>();
const USER_ORDERS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
```

### 3. Optimize Edge Functions Memory

**Priority: MEDIUM**

#### A. Share-Design Function
✅ Already optimized with:
- Early redirect for humans (no DB query)
- Cache-Control headers
- Single `.single()` query with explicit field selection

**No changes needed**

#### B. Verify-Xendit-Payment Function
🔴 **Issues Found:**
- Creates new Supabase client on every invocation
- Sequential queries that could be batched
- No caching of already-PAID status

**Optimization:**
```typescript
// Add early cache check before Xendit API call
if (paymentRecord.status === 'PAID') {
    return new Response(JSON.stringify({
        success: true,
        status: 'PAID',
        message: 'Status is already PAID.'
    }), {
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=60' // Cache for 1 minute
        },
        status: 200,
    });
}
```

### 4. Reduce Query Complexity

**Priority: HIGH**

#### A. Cart Operations - Batch Deletes
Current: Individual delete operations in cleanup
```typescript
// services/supabaseService.ts ~line 400
const deleteOps = itemsToDelete.map(item =>
    supabase.from('cakegenie_cart').delete().eq('cart_id', item.cart_id)
);
```

**Optimize to single query:**
```typescript
// Batch delete with IN clause
const cartIds = itemsToDelete.map(item => item.cart_id);
const { error } = await supabase
    .from('cakegenie_cart')
    .delete()
    .in('cart_id', cartIds);
```

#### B. Order Creation - Use RPC for Atomic Operations
✅ Already using RPC functions (`add_to_cart_rpc`, `create_order_rpc`)

**Good pattern - continue using this approach**

---

## Short-term Optimizations (1-7 days)

### 1. Implement Redis/Upstash for Hot Data

**Priority: HIGH**

Move frequently accessed, rarely changing data to Redis:

#### A. Pricing Rules Cache
- Current: 5-minute in-memory cache (resets on each Edge Function cold start)
- Target: Redis cache with 1-hour TTL
- Expected Impact: 90% reduction in pricing_rules table queries

```typescript
// Example using Upstash Redis
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function getPricingRulesWithRedis(): Promise<Map<string, PricingRule[]>> {
  const cacheKey = 'pricing:rules:all';

  // Try Redis first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return new Map(JSON.parse(cached as string));
  }

  // Fallback to database
  const rules = await fetchPricingRulesFromDB();

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(Array.from(rules.entries())));

  return rules;
}
```

#### B. Product Sizes Cache
- Target: Redis cache with 30-minute TTL
- Expected Impact: 85% reduction in productsizes_cakegenie queries

#### C. Active Discount Codes
- Target: Redis cache with 10-minute TTL
- Expected Impact: 80% reduction in discount_codes queries

### 2. Optimize Analysis Cache Strategy

**Priority: MEDIUM**

Current issues with `cakegenie_analysis_cache`:
- No TTL enforcement
- Potential for unbounded growth
- No cleanup mechanism

**Improvements:**

#### A. Add TTL Column and Auto-Cleanup
```sql
-- Migration: add_analysis_cache_ttl.sql
ALTER TABLE cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires
ON cakegenie_analysis_cache(expires_at)
WHERE expires_at IS NOT NULL;

-- Set default TTL to 7 days for existing records
UPDATE cakegenie_analysis_cache
SET expires_at = created_at + INTERVAL '7 days'
WHERE expires_at IS NULL;
```

#### B. Scheduled Cleanup Function
```sql
-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_analysis_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cakegenie_analysis_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup (using pg_cron extension)
SELECT cron.schedule('cleanup-analysis-cache', '0 2 * * *', 'SELECT cleanup_expired_analysis_cache()');
```

### 3. Add Query Performance Monitoring

**Priority: HIGH**

Enable pg_stat_statements extension to identify slow queries:

```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query to find slowest queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000 -- Queries taking more than 1 second on average
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 4. Optimize Frequent Query Patterns

**Priority: MEDIUM**

#### A. Cart Queries - Add Covering Indexes
```sql
-- Covering index for cart display queries
CREATE INDEX IF NOT EXISTS idx_cart_user_display
ON cakegenie_cart(user_id, deleted_at, created_at)
INCLUDE (cart_id, analysis_result, quantity, is_rush, final_price);
```

#### B. Orders Queries - Partial Indexes
```sql
-- Index only active orders (not completed/cancelled)
CREATE INDEX IF NOT EXISTS idx_orders_active
ON cakegenie_orders(user_id, created_at DESC)
WHERE payment_status IN ('pending', 'processing');
```

---

## Medium-term Improvements (1-4 weeks)

### 1. Implement Connection Pooling

**Priority: HIGH**

Supabase clients should use connection pooling:

```typescript
// lib/supabase/client.ts
export const getSupabaseClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema: 'public',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
      global: {
        headers: {
          'x-connection-pool': 'true' // Enable connection pooling
        }
      }
    }
  );
};
```

### 2. Implement Read Replicas (If Available)

**Priority: MEDIUM**

Route read-only queries to read replicas:

```typescript
// For read-heavy operations like cart display, order history
const supabaseRead = createClient(
  process.env.SUPABASE_READ_REPLICA_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// For writes, use primary
const supabasePrimary = getSupabaseClient();
```

### 3. Optimize RLS Policies

**Priority: MEDIUM**

Review Row Level Security policies for performance:

```sql
-- Check which RLS policies are being used frequently
SELECT
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Example optimization: Add index for RLS auth checks
CREATE INDEX IF NOT EXISTS idx_cart_user_auth
ON cakegenie_cart(user_id, session_id);
```

### 4. Implement Query Result Pagination

**Priority: MEDIUM**

For large result sets (orders, designs), implement cursor-based pagination:

```typescript
// Instead of loading all orders
const { data } = await supabase
  .from('cakegenie_orders')
  .select('*')
  .eq('user_id', userId)
  .limit(20) // Paginate
  .order('created_at', { ascending: false });
```

---

## Long-term Strategy (1-3 months)

### 1. Implement Full CDN Caching Layer

**Priority: MEDIUM**

Use Vercel Edge Config or similar for frequently accessed data:
- Product sizes
- Pricing rules (with invalidation on admin update)
- Shared design metadata

### 2. Implement Background Job Queue

**Priority: LOW**

Offload non-critical operations to background jobs:
- Analytics tracking
- Sitemap generation
- Cache warmup
- Old cart cleanup

### 3. Database Archival Strategy

**Priority: LOW**

Archive old records to reduce table size:
- Orders older than 1 year
- Analysis cache older than 30 days
- Deleted cart items older than 7 days

```sql
-- Create archive tables
CREATE TABLE cakegenie_orders_archive (LIKE cakegenie_orders INCLUDING ALL);
CREATE TABLE cakegenie_cart_archive (LIKE cakegenie_cart INCLUDING ALL);

-- Scheduled archival function
CREATE OR REPLACE FUNCTION archive_old_data()
RETURNS void AS $$
BEGIN
  -- Archive old orders
  INSERT INTO cakegenie_orders_archive
  SELECT * FROM cakegenie_orders
  WHERE created_at < NOW() - INTERVAL '1 year';

  DELETE FROM cakegenie_orders
  WHERE created_at < NOW() - INTERVAL '1 year';

  -- Archive deleted cart items
  INSERT INTO cakegenie_cart_archive
  SELECT * FROM cakegenie_cart
  WHERE deleted_at < NOW() - INTERVAL '7 days';

  DELETE FROM cakegenie_cart
  WHERE deleted_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

---

## Monitoring and Alerting

### 1. Supabase Dashboard Metrics to Monitor

**Daily Checks:**
- Disk IO usage percentage
- Cache hit rate (target: >95%)
- Slow queries (>1 second)
- Active connections
- Table sizes

### 2. Custom Monitoring Queries

```sql
-- Check cache hit rate
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;
```

### 3. Alert Thresholds

Set up alerts for:
- ⚠️ Disk IO usage > 70%
- 🔴 Disk IO usage > 85%
- ⚠️ Cache hit rate < 90%
- 🔴 Cache hit rate < 85%
- ⚠️ Query execution time > 2 seconds
- 🔴 Query execution time > 5 seconds

---

## Implementation Checklist

### Week 1 (Immediate)
- [ ] Run index creation script (`add_performance_indexes.sql`)
- [ ] Verify indexes were created successfully
- [ ] Add caching to discount code validation
- [ ] Add caching to product sizes
- [ ] Optimize cart batch delete operations
- [ ] Add Cache-Control headers to payment verification
- [ ] Enable pg_stat_statements extension
- [ ] Run initial slow query analysis

### Week 2 (Quick Wins)
- [ ] Implement Redis/Upstash setup
- [ ] Migrate pricing rules cache to Redis
- [ ] Migrate product sizes cache to Redis
- [ ] Add TTL column to analysis cache
- [ ] Create analysis cache cleanup function
- [ ] Schedule daily cleanup job
- [ ] Monitor Disk IO metrics daily

### Week 3-4 (Short-term)
- [ ] Implement connection pooling
- [ ] Add covering indexes for frequently accessed queries
- [ ] Optimize RLS policies
- [ ] Implement pagination for order lists
- [ ] Create monitoring dashboard
- [ ] Document cache invalidation strategies

### Month 2+ (Medium-term)
- [ ] Evaluate read replica strategy
- [ ] Implement CDN caching layer
- [ ] Create background job queue
- [ ] Design data archival strategy
- [ ] Implement automated alerting

---

## Expected Impact

### Immediate Wins (Week 1)
- **Disk IO Reduction:** 40-50% reduction
- **Query Performance:** 50-70% improvement on indexed queries
- **Cache Hit Rate:** Increase from current to 85-90%

### Short-term (Month 1)
- **Disk IO Reduction:** 60-70% reduction
- **Query Performance:** 70-85% improvement
- **Cache Hit Rate:** 90-95%

### Long-term (3 Months)
- **Disk IO Reduction:** 75-85% reduction
- **Query Performance:** 85-95% improvement
- **Cache Hit Rate:** 95-98%
- **Cost Savings:** Potential to downgrade Supabase plan

---

## Risk Assessment

### Low Risk (Safe to implement immediately)
- ✅ Adding indexes
- ✅ Enabling query monitoring
- ✅ Adding cache headers
- ✅ Implementing in-memory caching

### Medium Risk (Test thoroughly)
- ⚠️ Batch operations (test with small datasets first)
- ⚠️ Redis integration (ensure fallback to DB works)
- ⚠️ RLS policy changes (verify auth still works)

### High Risk (Require careful planning)
- 🔴 Data archival (ensure no data loss)
- 🔴 Read replica setup (coordinate with Supabase support)
- 🔴 Connection pooling changes (monitor connection errors)

---

## Success Metrics

Track these metrics weekly:

| Metric | Current | Week 1 Target | Month 1 Target | Success |
|--------|---------|---------------|----------------|---------|
| Disk IO Usage | ~100% | <70% | <50% | ✅ |
| Cache Hit Rate | Unknown | >85% | >92% | ✅ |
| Avg Query Time | Unknown | <500ms | <200ms | ✅ |
| Slow Queries (>1s) | Unknown | <10/day | <2/day | ✅ |
| Edge Function Cold Starts | Unknown | -50% | -70% | ✅ |

---

## Next Steps

1. **IMMEDIATE (Today):** Run the index creation script
2. **Day 2:** Enable pg_stat_statements and run slow query analysis
3. **Day 3:** Implement discount code and product size caching
4. **Day 4-5:** Set up Redis/Upstash account and migrate pricing cache
5. **Week 2:** Review metrics and adjust strategy

---

## Resources

- [Supabase Disk IO Troubleshooting Guide](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Upstash Redis for Edge Functions](https://upstash.com/docs/redis/overall/getstarted)
- [Vercel Edge Config](https://vercel.com/docs/storage/edge-config)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Owner:** Development Team
**Review Schedule:** Weekly for first month, then monthly
