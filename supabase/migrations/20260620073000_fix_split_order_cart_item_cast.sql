create or replace function public.create_split_order_from_cart(
    p_user_id uuid,
    p_delivery_address_id uuid,
    p_delivery_date date,
    p_delivery_time_slot text,
    p_subtotal numeric,
    p_delivery_fee numeric,
    p_delivery_instructions text default null,
    p_discount_amount numeric default 0,
    p_discount_code_id uuid default null,
    p_recipient_name text default null,
    p_recipient_phone text default null,
    p_delivery_address text default null,
    p_delivery_city text default null,
    p_delivery_latitude numeric default null,
    p_delivery_longitude numeric default null,
    p_is_split_order boolean default false,
    p_split_message text default null,
    p_split_count integer default null,
    p_cart_item_ids text[] default null
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_order_id uuid;
    v_order_number text;
    v_total_amount numeric;
    v_now_manila_date date := timezone('Asia/Manila', now())::date;
begin
    if p_split_message = 'downpayment_50'
       and p_delivery_date < (v_now_manila_date + 3) then
        raise exception 'A minimum of 3 days lead time is required for 50%% downpayments.';
    end if;

    v_total_amount := p_subtotal + p_delivery_fee - p_discount_amount;
    v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 99999)::text, 5, '0');

    insert into public.cakegenie_orders (
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
        delivery_latitude,
        delivery_longitude,
        is_split_order,
        split_message,
        split_count,
        organizer_user_id,
        amount_collected
    )
    values (
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
        'pending',
        'pending',
        p_recipient_name,
        p_recipient_phone,
        p_delivery_address,
        p_delivery_city,
        p_delivery_latitude,
        p_delivery_longitude,
        p_is_split_order,
        p_split_message,
        p_split_count,
        case when p_is_split_order then p_user_id else null end,
        0
    )
    returning cakegenie_orders.order_id into v_order_id;

    insert into public.cakegenie_order_items (
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
    select
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
    from public.cakegenie_cart cart
    where (cart.user_id = p_user_id or cart.session_id = p_user_id::text)
      and cart.expires_at > now()
      and (
        p_cart_item_ids is null
        or cart.cart_item_id::text = any(p_cart_item_ids)
      );

    delete from public.cakegenie_cart
    where (user_id = p_user_id or session_id = p_user_id::text)
      and expires_at > now()
      and (
        p_cart_item_ids is null
        or cart_item_id::text = any(p_cart_item_ids)
      );

    if p_discount_code_id is not null then
        insert into public.discount_code_usage (
            discount_code_id,
            user_id,
            order_id,
            discount_amount_applied
        )
        values (
            p_discount_code_id,
            p_user_id,
            v_order_id,
            p_discount_amount
        );

        update public.discount_codes
           set times_used = times_used + 1
         where code_id = p_discount_code_id;
    end if;

    return query select v_order_id, v_order_number;
end;
$function$;
