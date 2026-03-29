-- Create cakegenie_reviews table for product/order reviews
CREATE TABLE IF NOT EXISTS cakegenie_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES cakegenie_orders(order_id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES cakegenie_order_items(item_id) ON DELETE SET NULL,
    user_id UUID REFERENCES cakegenie_users(user_id) ON DELETE SET NULL,
    merchant_id UUID NOT NULL REFERENCES cakegenie_merchants(merchant_id) ON DELETE CASCADE,
    product_id UUID REFERENCES cakegenie_merchant_products(product_id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    photos TEXT[] DEFAULT '{}',
    is_approved BOOLEAN DEFAULT true,
    is_visible BOOLEAN DEFAULT true,
    merchant_response TEXT,
    merchant_response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries by merchant, product, and user
CREATE INDEX idx_reviews_merchant_id ON cakegenie_reviews(merchant_id);
CREATE INDEX idx_reviews_product_id ON cakegenie_reviews(product_id);
CREATE INDEX idx_reviews_user_id ON cakegenie_reviews(user_id);
CREATE INDEX idx_reviews_order_id ON cakegenie_reviews(order_id);
CREATE INDEX idx_reviews_is_visible ON cakegenie_reviews(is_visible) WHERE is_visible = true;
CREATE INDEX idx_reviews_rating ON cakegenie_reviews(rating);

-- Enable Row Level Security
ALTER TABLE cakegenie_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can see approved visible reviews
CREATE POLICY "Public can view approved visible reviews"
    ON cakegenie_reviews FOR SELECT
    USING (is_visible = true AND is_approved = true);

-- Policy: Users can view their own reviews
CREATE POLICY "Users can view own reviews"
    ON cakegenie_reviews FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Merchants can view reviews for their shop
CREATE POLICY "Merchants can view reviews for their shop"
    ON cakegenie_reviews FOR SELECT
    USING (auth.uid() IN (
        SELECT user_id FROM merchant_staff 
        WHERE merchant_id = cakegenie_reviews.merchant_id AND is_active = true
    ));

-- Policy: Authenticated users can insert reviews
CREATE POLICY "Authenticated users can insert reviews"
    ON cakegenie_reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Users can update their own reviews
CREATE POLICY "Users can update own reviews"
    ON cakegenie_reviews FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Merchants can update visibility and respond to reviews
CREATE POLICY "Merchants can manage reviews for their shop"
    ON cakegenie_reviews FOR UPDATE
    USING (auth.uid() IN (
        SELECT user_id FROM merchant_staff 
        WHERE merchant_id = cakegenie_reviews.merchant_id AND is_active = true
    ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_cakegenie_reviews_timestamp
    BEFORE UPDATE ON cakegenie_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_review_timestamp();

-- Function to recalculate merchant rating when review is approved
CREATE OR REPLACE FUNCTION update_merchant_rating_on_review()
RETURNS TRIGGER AS $$
BEGIN
    -- Update merchant rating and review_count when a review is approved or unapproved
    IF NEW.is_approved = true AND NEW.is_visible = true THEN
        UPDATE cakegenie_merchants
        SET 
            rating = (
                SELECT COALESCE(AVG(rating), 0) 
                FROM cakegenie_reviews 
                WHERE merchant_id = NEW.merchant_id 
                AND is_approved = true 
                AND is_visible = true
            ),
            review_count = (
                SELECT COUNT(*) 
                FROM cakegenie_reviews 
                WHERE merchant_id = NEW.merchant_id 
                AND is_approved = true 
                AND is_visible = true
            ),
            updated_at = NOW()
        WHERE merchant_id = NEW.merchant_id;
    ELSE
        -- Recalculate even when hidden to keep stats accurate
        UPDATE cakegenie_merchants
        SET 
            rating = (
                SELECT COALESCE(AVG(rating), 0) 
                FROM cakegenie_reviews 
                WHERE merchant_id = NEW.merchant_id 
                AND is_approved = true 
                AND is_visible = true
            ),
            review_count = (
                SELECT COUNT(*) 
                FROM cakegenie_reviews 
                WHERE merchant_id = NEW.merchant_id 
                AND is_approved = true 
                AND is_visible = true
            ),
            updated_at = NOW()
        WHERE merchant_id = NEW.merchant_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for merchant rating update
CREATE TRIGGER update_merchant_rating_trigger
    AFTER INSERT OR UPDATE ON cakegenie_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_rating_on_review();

-- Comment on table
COMMENT ON TABLE cakegenie_reviews IS 'Product and service reviews from customers for merchants and products';
COMMENT ON COLUMN cakegenie_reviews.rating IS 'Star rating from 1 to 5';
COMMENT ON COLUMN cakegenie_reviews.is_approved IS 'Whether review has been approved by moderators';
COMMENT ON COLUMN cakegenie_reviews.is_visible IS 'Whether review is publicly visible';
COMMENT ON COLUMN cakegenie_reviews.merchant_response IS 'Response from the merchant/shop owner';