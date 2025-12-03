-- Verification queries for delivery coordinates implementation
-- Run these in your Supabase SQL Editor after applying the migration

-- 1. Check if columns were added successfully
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'cakegenie_orders'
AND column_name IN ('delivery_latitude', 'delivery_longitude')
ORDER BY column_name;

-- 2. Check the create_order_from_cart function signature
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_order_from_cart';

-- 3. Check the create_split_order_from_cart function signature
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_split_order_from_cart';

-- 4. View recent orders with coordinates (after testing)
SELECT 
    order_id,
    order_number,
    recipient_name,
    delivery_address,
    delivery_city,
    delivery_latitude,
    delivery_longitude,
    delivery_address_id,
    created_at
FROM public.cakegenie_orders
ORDER BY created_at DESC
LIMIT 10;

-- 5. Count orders with coordinates vs without
SELECT 
    COUNT(*) FILTER (WHERE delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL) as orders_with_coordinates,
    COUNT(*) FILTER (WHERE delivery_latitude IS NULL AND delivery_longitude IS NULL) as orders_without_coordinates,
    COUNT(*) as total_orders
FROM public.cakegenie_orders;
