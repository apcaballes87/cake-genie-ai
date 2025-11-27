-- Add columns to cakegenie_orders
ALTER TABLE public.cakegenie_orders
ADD COLUMN IF NOT EXISTS is_split_order boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS split_message text,
ADD COLUMN IF NOT EXISTS split_count integer,
ADD COLUMN IF NOT EXISTS amount_collected numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS organizer_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS split_share_url text;

-- Create order_contributions table
CREATE TABLE IF NOT EXISTS public.order_contributions (
    contribution_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.cakegenie_orders(order_id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    contributor_name text,
    contributor_email text,
    amount numeric NOT NULL,
    xendit_invoice_id text,
    payment_url text,
    status text DEFAULT 'pending',
    paid_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_contributions ENABLE ROW LEVEL SECURITY;

-- Create policies for order_contributions
CREATE POLICY "Public contributions access" ON public.order_contributions
    FOR SELECT USING (true);

CREATE POLICY "Users can view their own contributions" ON public.order_contributions
    FOR ALL USING (auth.uid() = user_id);

-- Create trigger function to update order status
CREATE OR REPLACE FUNCTION public.handle_order_contribution_update()
RETURNS TRIGGER AS $$
DECLARE
    v_total_collected numeric;
    v_order_total numeric;
BEGIN
    -- Only proceed if status changed to 'paid'
    IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
        -- Update amount_collected in orders table
        UPDATE public.cakegenie_orders
        SET amount_collected = (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.order_contributions
            WHERE order_id = NEW.order_id
            AND status = 'paid'
        )
        WHERE order_id = NEW.order_id
        RETURNING total_amount, amount_collected INTO v_order_total, v_total_collected;

        -- Check if fully funded
        IF v_total_collected >= v_order_total THEN
            UPDATE public.cakegenie_orders
            SET payment_status = 'paid',
                order_status = 'confirmed'
            WHERE order_id = NEW.order_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_contribution_status_change ON public.order_contributions;
CREATE TRIGGER on_contribution_status_change
AFTER UPDATE OF status ON public.order_contributions
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_contribution_update();

-- Create RPC function create_split_order_from_cart
CREATE OR REPLACE FUNCTION public.create_split_order_from_cart(
    p_user_id uuid,
    p_delivery_address_id uuid,
    p_delivery_date date,
    p_delivery_time_slot text,
    p_subtotal numeric,
    p_delivery_fee numeric,
    p_delivery_instructions text DEFAULT NULL::text,
    p_discount_amount numeric DEFAULT 0,
    p_discount_code_id uuid DEFAULT NULL::uuid,
    p_recipient_name text DEFAULT NULL::text,
    p_recipient_phone text DEFAULT NULL::text,
    p_delivery_address text DEFAULT NULL::text,
    p_delivery_city text DEFAULT NULL::text,
    -- New parameters for split order
    p_is_split_order boolean DEFAULT false,
    p_split_message text DEFAULT NULL::text,
    p_split_count integer DEFAULT NULL::integer
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC;
BEGIN
    -- Calculate total amount
    v_total_amount := p_subtotal + p_delivery_fee - p_discount_amount;

    -- Generate unique order number (format: ORD-YYYYMMDD-XXXXX)
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');

    -- Create the order
    INSERT INTO public.cakegenie_orders (
        user_id,
        order_number,
        delivery_address_id,
        delivery_date,
        delivery_time_slot,
        delivery_instructions,
        subtotal,
        delivery_fee,
        discount_amount,
        discount_code_id,
        total_amount,
        order_status,
        payment_status,
        recipient_name,
        delivery_phone,
        delivery_address,
        delivery_city,
        -- Split order fields
        is_split_order,
        split_message,
        split_count,
        organizer_user_id,
        amount_collected
    )
    VALUES (
        p_user_id,
        v_order_number,
        p_delivery_address_id,
        p_delivery_date,
        p_delivery_time_slot,
        p_delivery_instructions,
        p_subtotal,
        p_delivery_fee,
        p_discount_amount,
        p_discount_code_id,
        v_total_amount,
        'pending', -- order_status
        'pending', -- payment_status
        p_recipient_name,
        p_recipient_phone,
        p_delivery_address,
        p_delivery_city,
        -- Split order values
        p_is_split_order,
        p_split_message,
        p_split_count,
        CASE WHEN p_is_split_order THEN p_user_id ELSE NULL END,
        0 -- Initial amount_collected
    )
    RETURNING cakegenie_orders.order_id INTO v_order_id;

    -- Copy cart items to order_items
    INSERT INTO public.cakegenie_order_items (
        order_id,
        cake_type,
        cake_thickness,
        cake_size,
        base_price,
        addon_price,
        final_price,
        quantity,
        original_image_url,
        customized_image_url,
        customization_details
    )
    SELECT
        v_order_id,
        cart.cake_type,
        cart.cake_thickness,
        cart.cake_size,
        cart.base_price,
        cart.addon_price,
        cart.final_price,
        cart.quantity,
        cart.original_image_url,
        cart.customized_image_url,
        cart.customization_details
    FROM public.cakegenie_cart cart
    WHERE (cart.user_id = p_user_id OR cart.session_id = p_user_id::text)
    AND cart.expires_at > NOW();

    -- Delete cart items after copying to order
    DELETE FROM public.cakegenie_cart
    WHERE (user_id = p_user_id OR session_id = p_user_id::text)
    AND expires_at > NOW();

    -- If a discount code was used, record it in discount_code_usage
    IF p_discount_code_id IS NOT NULL THEN
        -- Insert into discount_code_usage table
        INSERT INTO public.discount_code_usage (
            discount_code_id,
            user_id,
            order_id,
            discount_amount_applied
        )
        VALUES (
            p_discount_code_id,
            p_user_id,
            v_order_id,
            p_discount_amount
        );

        -- Increment the times_used counter on the discount code
        UPDATE public.discount_codes
        SET times_used = times_used + 1
        WHERE code_id = p_discount_code_id;
    END IF;

    -- Return the order details
    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;
