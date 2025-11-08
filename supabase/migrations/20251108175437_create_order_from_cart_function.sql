-- Create the create_order_from_cart function
CREATE OR REPLACE FUNCTION create_order_from_cart(
  p_user_id UUID,
  p_discount_code_id UUID DEFAULT NULL,
  p_delivery_address_id UUID DEFAULT NULL,
  p_delivery_date DATE DEFAULT NULL,
  p_delivery_time_slot VARCHAR(50) DEFAULT NULL,
  p_delivery_instructions TEXT DEFAULT NULL,
  p_payment_method VARCHAR(50) DEFAULT NULL,
  p_order_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  order_id UUID,
  order_number VARCHAR(50),
  total_amount NUMERIC(10, 2),
  discount_amount NUMERIC(10, 2)
) AS $$
DECLARE
  v_order_id UUID;
  v_order_number VARCHAR(50);
  v_subtotal NUMERIC(10, 2) := 0;
  v_total_amount NUMERIC(10, 2) := 0;
  v_discount_amount NUMERIC(10, 2) := 0;
  v_discount_percentage NUMERIC(5, 2) := 0;
  v_cart_items RECORD;
  v_cart_item_count INTEGER := 0;
BEGIN
  -- Check if user has items in cart
  SELECT COUNT(*) INTO v_cart_item_count 
  FROM cakegenie_cart 
  WHERE user_id = p_user_id;
  
  IF v_cart_item_count = 0 THEN
    RAISE EXCEPTION 'No items found in cart for user';
  END IF;
  
  -- Start transaction
  BEGIN
    -- Generate unique order number
    v_order_number := 'CG' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Calculate subtotal from cart items
    SELECT COALESCE(SUM(final_price * quantity), 0) INTO v_subtotal
    FROM cakegenie_cart
    WHERE user_id = p_user_id;
    
    -- Apply discount if provided
    IF p_discount_code_id IS NOT NULL THEN
      -- Get discount details
      SELECT 
        COALESCE(discount_amount, 0),
        COALESCE(discount_percentage, 0)
      INTO 
        v_discount_amount,
        v_discount_percentage
      FROM discount_codes
      WHERE code_id = p_discount_code_id
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND times_used < max_uses
        AND (user_id IS NULL OR user_id = p_user_id);
      
      -- Apply discount
      IF v_discount_percentage > 0 THEN
        v_discount_amount := v_subtotal * (v_discount_percentage / 100);
      END IF;
      
      -- Ensure discount doesn't exceed subtotal
      v_discount_amount := LEAST(v_discount_amount, v_subtotal);
    END IF;
    
    -- Calculate total
    v_total_amount := v_subtotal - v_discount_amount;
    
    -- Create the order
    INSERT INTO cakegenie_orders (
      user_id,
      order_number,
      subtotal,
      discount_amount,
      discount_percentage,
      total_amount,
      delivery_address_id,
      delivery_date,
      delivery_time_slot,
      delivery_instructions,
      payment_method,
      order_notes,
      discount_code_id
    ) VALUES (
      p_user_id,
      v_order_number,
      v_subtotal,
      v_discount_amount,
      v_discount_percentage,
      v_total_amount,
      p_delivery_address_id,
      p_delivery_date,
      p_delivery_time_slot,
      p_delivery_instructions,
      p_payment_method,
      p_order_notes,
      p_discount_code_id
    ) RETURNING cakegenie_orders.order_id INTO v_order_id;
    
    -- Copy cart items to order items
    INSERT INTO cakegenie_order_items (
      item_id,
      order_id,
      cake_type,
      cake_thickness,
      cake_size,
      base_price,
      addon_price,
      final_price,
      original_image_url,
      customized_image_url,
      customization_details,
      quantity
    )
    SELECT 
      gen_random_uuid(),
      v_order_id,
      cake_type,
      cake_thickness,
      cake_size,
      base_price,
      addon_price,
      final_price,
      original_image_url,
      customized_image_url,
      customization_details,
      quantity
    FROM cakegenie_cart
    WHERE user_id = p_user_id;
    
    -- Increment discount code usage
    IF p_discount_code_id IS NOT NULL THEN
      UPDATE discount_codes 
      SET times_used = times_used + 1 
      WHERE code_id = p_discount_code_id;
    END IF;
    
    -- Clear the user's cart
    DELETE FROM cakegenie_cart WHERE user_id = p_user_id;
    
    -- Return order details
    RETURN QUERY
    SELECT 
      v_order_id as order_id,
      v_order_number as order_number,
      v_total_amount as total_amount,
      v_discount_amount as discount_amount;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_order_from_cart(UUID, UUID, UUID, DATE, VARCHAR(50), TEXT, VARCHAR(50), TEXT) TO anon, authenticated;

COMMENT ON FUNCTION create_order_from_cart IS 'Creates an order from a user''s cart items, applies discount if provided, and clears the cart';