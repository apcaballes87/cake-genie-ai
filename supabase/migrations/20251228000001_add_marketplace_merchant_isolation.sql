-- ============================================================================
-- MIGRATION: Add Merchant Isolation for Two-Sided Marketplace
-- Created: 2025-12-27
-- Description: Adds merchant_id to cart, orders, and order_items tables,
--              creates merchant_staff and merchant_payouts tables,
--              and sets up RLS policies for data isolation.
-- ============================================================================

-- --------------------------------
-- STEP 1: Add merchant_id to existing tables
-- --------------------------------

-- Add merchant_id to cart items (nullable initially for backward compatibility)
ALTER TABLE cakegenie_cart 
ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES cakegenie_merchants(merchant_id);

-- Add merchant_id to orders
ALTER TABLE cakegenie_orders 
ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES cakegenie_merchants(merchant_id);

-- Add merchant_id to order items (denormalized for query performance)
ALTER TABLE cakegenie_order_items 
ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES cakegenie_merchants(merchant_id);

-- Add index for faster merchant-scoped queries
CREATE INDEX IF NOT EXISTS idx_cart_merchant_id ON cakegenie_cart(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON cakegenie_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_merchant_id ON cakegenie_order_items(merchant_id);

-- --------------------------------
-- STEP 2: Create merchant_staff table
-- --------------------------------

CREATE TABLE IF NOT EXISTS merchant_staff (
  staff_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES cakegenie_merchants(merchant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  permissions JSONB DEFAULT '{"manage_products": true, "view_orders": true, "manage_orders": false, "view_analytics": false}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, user_id)
);

-- Index for user lookups (which merchants does this user work for?)
CREATE INDEX IF NOT EXISTS idx_merchant_staff_user ON merchant_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_staff_merchant ON merchant_staff(merchant_id);

-- --------------------------------
-- STEP 3: Create merchant_payouts table
-- --------------------------------

CREATE TABLE IF NOT EXISTS merchant_payouts (
  payout_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES cakegenie_merchants(merchant_id) ON DELETE CASCADE,
  order_id UUID REFERENCES cakegenie_orders(order_id) ON DELETE SET NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,4) DEFAULT 0.1000, -- 10% default commission
  commission_amount DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payout_method TEXT, -- 'bank_transfer', 'gcash', 'maya', etc.
  payout_reference TEXT, -- External reference ID from payment provider
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payout queries
CREATE INDEX IF NOT EXISTS idx_payouts_merchant ON merchant_payouts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON merchant_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_order ON merchant_payouts(order_id);

-- --------------------------------
-- STEP 4: Create helper function for merchant access
-- --------------------------------

-- Function to check if current user has access to a merchant
CREATE OR REPLACE FUNCTION private.get_user_merchant_role(p_merchant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM merchant_staff
  WHERE merchant_id = p_merchant_id
    AND user_id = auth.uid()
    AND is_active = true;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get all merchant IDs the current user has access to
CREATE OR REPLACE FUNCTION private.get_user_merchant_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT merchant_id
  FROM merchant_staff
  WHERE user_id = auth.uid()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- --------------------------------
-- STEP 5: Enable RLS on new tables
-- --------------------------------

ALTER TABLE merchant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_payouts ENABLE ROW LEVEL SECURITY;

-- --------------------------------
-- STEP 6: RLS Policies for merchant_staff
-- --------------------------------

-- Staff can view their own membership records
CREATE POLICY "staff_view_own_membership" ON merchant_staff
  FOR SELECT
  USING (user_id = auth.uid());

-- Owners and admins can view all staff for their merchant
CREATE POLICY "owners_view_merchant_staff" ON merchant_staff
  FOR SELECT
  USING (
    private.get_user_merchant_role(merchant_id) IN ('owner', 'admin')
  );

-- Only owners can insert new staff
CREATE POLICY "owners_insert_staff" ON merchant_staff
  FOR INSERT
  WITH CHECK (
    private.get_user_merchant_role(merchant_id) = 'owner'
  );

-- Only owners can update staff records
CREATE POLICY "owners_update_staff" ON merchant_staff
  FOR UPDATE
  USING (
    private.get_user_merchant_role(merchant_id) = 'owner'
  );

-- Only owners can delete staff
CREATE POLICY "owners_delete_staff" ON merchant_staff
  FOR DELETE
  USING (
    private.get_user_merchant_role(merchant_id) = 'owner'
  );

-- --------------------------------
-- STEP 7: RLS Policies for merchant_payouts
-- --------------------------------

-- Owners and admins can view payouts
CREATE POLICY "merchant_view_payouts" ON merchant_payouts
  FOR SELECT
  USING (
    private.get_user_merchant_role(merchant_id) IN ('owner', 'admin')
  );

-- System/admin inserts done via service role (no user-facing insert policy)

-- --------------------------------
-- STEP 8: Add triggers for updated_at
-- --------------------------------

-- Generic function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for merchant_staff
DROP TRIGGER IF EXISTS updated_at_merchant_staff ON merchant_staff;
CREATE TRIGGER updated_at_merchant_staff
  BEFORE UPDATE ON merchant_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for merchant_payouts  
DROP TRIGGER IF EXISTS updated_at_merchant_payouts ON merchant_payouts;
CREATE TRIGGER updated_at_merchant_payouts
  BEFORE UPDATE ON merchant_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------
-- STEP 9: Create view for merchant dashboard stats
-- --------------------------------

CREATE OR REPLACE VIEW merchant_dashboard_stats AS
SELECT 
  m.merchant_id,
  m.business_name,
  COUNT(DISTINCT o.order_id) AS total_orders,
  COUNT(DISTINCT CASE WHEN o.order_status = 'pending' THEN o.order_id END) AS pending_orders,
  COUNT(DISTINCT CASE WHEN o.order_status = 'delivered' THEN o.order_id END) AS completed_orders,
  COALESCE(SUM(o.total_amount), 0) AS total_revenue,
  COALESCE(SUM(CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN o.total_amount ELSE 0 END), 0) AS revenue_30d,
  COUNT(DISTINCT mp.product_id) AS active_products
FROM cakegenie_merchants m
LEFT JOIN cakegenie_orders o ON o.merchant_id = m.merchant_id
LEFT JOIN cakegenie_merchant_products mp ON mp.merchant_id = m.merchant_id AND mp.is_active = true
WHERE m.is_active = true
GROUP BY m.merchant_id, m.business_name;

-- ================================
-- MIGRATION COMPLETE
-- ================================
