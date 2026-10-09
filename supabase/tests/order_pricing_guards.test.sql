-- Regression tests for the order-price tampering incident
-- (migration 20261009100000_server_side_order_pricing.sql).
--
-- Run against a Supabase branch / local stack, never production. Everything runs
-- inside one transaction that is rolled back.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET LOCAL search_path = public, extensions, pg_temp;

SELECT plan(9);

-- Two throwaway auth users (the attacker and a victim).
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pricing-test-attacker@example.test', now(), now()),
    ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pricing-test-victim@example.test', now(), now());

-- Act as the attacker: an ordinary signed-in customer.
SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text,
    true
);
SET LOCAL ROLE authenticated;

-- 1. The exact incident: cart row with final_price 0.01 and no cake type.
SELECT throws_ok(
    $$INSERT INTO public.cakegenie_cart (user_id, base_price, addon_price, final_price, quantity, customization_details)
      VALUES ('00000000-0000-0000-0000-0000000000a1', 0.01, 0, 0.01, 1, '{}'::jsonb)$$,
    '22023',
    NULL,
    'cart row with a hand-built 0.01 price is rejected'
);

-- 2. A typed item can still not be priced near zero.
SELECT throws_ok(
    $$INSERT INTO public.cakegenie_cart (user_id, cake_type, cake_size, cake_thickness, base_price, addon_price, final_price, quantity, customization_details)
      VALUES ('00000000-0000-0000-0000-0000000000a1', 'Bento', '4" Round', '2 in', 1, 0, 1, 1, '{}'::jsonb)$$,
    '22023',
    NULL,
    'typed cart row priced at 1 peso is rejected'
);

-- 3. final_price must equal base + add-ons.
SELECT throws_ok(
    $$INSERT INTO public.cakegenie_cart (user_id, cake_type, cake_size, cake_thickness, base_price, addon_price, final_price, quantity, customization_details)
      VALUES ('00000000-0000-0000-0000-0000000000a1', 'Bento', '4" Round', '2 in', 499, 100, 150, 1, '{}'::jsonb)$$,
    '22023',
    NULL,
    'final price that disagrees with base + addons is rejected'
);

-- 4. A legitimate cart row still works.
SELECT lives_ok(
    $$INSERT INTO public.cakegenie_cart (user_id, cake_type, cake_size, cake_thickness, base_price, addon_price, final_price, quantity, customization_details)
      VALUES ('00000000-0000-0000-0000-0000000000a1', 'Bento', '4" Round', '2 in', 499, 100, 599, 1, '{}'::jsonb)$$,
    'a normal Bento cart row is accepted'
);

-- 5. Editing a good cart row down to a bad price is rejected.
SELECT throws_ok(
    $$UPDATE public.cakegenie_cart
         SET base_price = 1, addon_price = 0, final_price = 1
       WHERE user_id = '00000000-0000-0000-0000-0000000000a1'$$,
    '22023',
    NULL,
    'updating a cart row down to 1 peso is rejected'
);

-- 6. The RPC ignores the client subtotal: the order is priced from the cart rows.
SELECT lives_ok(
    $$SELECT * FROM public.create_order_from_cart(
        p_user_id := '00000000-0000-0000-0000-0000000000a1',
        p_delivery_address_id := NULL,
        p_delivery_date := current_date + 5,
        p_delivery_time_slot := '10:00',
        p_subtotal := 0.01,
        p_delivery_fee := 0)$$,
    'order is created even though the client sent subtotal 0.01'
);

SELECT is(
    (SELECT total_amount FROM public.cakegenie_orders
      WHERE user_id = '00000000-0000-0000-0000-0000000000a1'
      ORDER BY created_at DESC LIMIT 1),
    599.00::numeric,
    'order total comes from the cart rows (599), not the client subtotal (0.01)'
);

-- 7. Cannot create an order for someone else.
SELECT throws_ok(
    $$SELECT * FROM public.create_order_from_cart(
        p_user_id := '00000000-0000-0000-0000-0000000000b2',
        p_delivery_address_id := NULL,
        p_delivery_date := current_date + 5,
        p_delivery_time_slot := '10:00',
        p_subtotal := 100,
        p_delivery_fee := 0)$$,
    '42501',
    NULL,
    'an order cannot be created for another user id'
);

-- 8. Negative delivery fee cannot cancel out the subtotal.
SELECT throws_ok(
    $$SELECT * FROM public.create_order_from_cart(
        p_user_id := '00000000-0000-0000-0000-0000000000a1',
        p_delivery_address_id := NULL,
        p_delivery_date := current_date + 5,
        p_delivery_time_slot := '10:00',
        p_subtotal := 100,
        p_delivery_fee := -500)$$,
    '22023',
    NULL,
    'a negative delivery fee is rejected'
);

SELECT * FROM finish();

ROLLBACK;
