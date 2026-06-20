create or replace function public.clear_cart_for_paid_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    v_order_user_id uuid;
    v_payment_status text;
    v_is_split_order boolean;
    v_split_message text;
    v_deleted_count integer := 0;
begin
    select
        user_id,
        payment_status,
        is_split_order,
        split_message
      into
        v_order_user_id,
        v_payment_status,
        v_is_split_order,
        v_split_message
      from public.cakegenie_orders
     where order_id = p_order_id;

    if not found then
        raise exception 'clear_cart_for_paid_order: order % not found', p_order_id;
    end if;

    if v_payment_status is distinct from 'paid'
       and v_payment_status is distinct from 'partial' then
        raise exception 'clear_cart_for_paid_order: order % is not paid (current payment_status=%)',
            p_order_id, v_payment_status;
    end if;

    if auth.uid() is not null and auth.uid() is distinct from v_order_user_id then
        raise exception 'clear_cart_for_paid_order: caller is not the order owner';
    end if;

    if v_is_split_order and v_split_message = 'downpayment_50' then
        return 0;
    end if;

    with deleted as (
        delete from public.cakegenie_cart
         where (user_id = v_order_user_id or session_id = v_order_user_id::text)
           and expires_at > now()
        returning cart_item_id
    )
    select count(*) into v_deleted_count from deleted;

    return v_deleted_count;
end;
$function$;
