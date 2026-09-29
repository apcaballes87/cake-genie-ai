import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
    'supabase/migrations/20260929082800_prevent_empty_cart_orders.sql',
    'utf8',
);

describe('cart order persistence migration', () => {
    it('requires a non-empty, unique list of active cart rows owned by the order user', () => {
        expect(migration).toContain('IF p_cart_item_ids IS NULL OR cardinality(p_cart_item_ids) = 0 THEN');
        expect(migration).toContain('count(DISTINCT requested.cart_item_id)');
        expect(migration).toContain('cart.cart_item_id::text = ANY(p_cart_item_ids)');
        expect(migration).toContain('(cart.user_id = p_user_id OR cart.session_id = p_user_id::text)');
        expect(migration).toContain('AND cart.expires_at > NOW()');
        expect(migration).toContain("cart.customized_image_url ~* '^https?://'");
        expect(migration).toContain('FOR UPDATE OF cart;');
    });

    it('guards both order RPCs and verifies that every requested item was copied', () => {
        const orderFunctions = migration.split('CREATE OR REPLACE FUNCTION public.create_order_from_cart(')[1];
        const splitFunctions = migration.split('CREATE OR REPLACE FUNCTION public.create_split_order_from_cart(')[1];

        expect(orderFunctions).toBeDefined();
        expect(splitFunctions).toBeDefined();

        for (const functionBody of [orderFunctions, splitFunctions]) {
            expect(functionBody).toContain('PERFORM public.assert_checkout_cart_items(p_user_id, p_cart_item_ids);');
            expect(functionBody).toContain('GET DIAGNOSTICS v_order_item_count = ROW_COUNT;');
            expect(functionBody).toContain('IF v_order_item_count <> cardinality(p_cart_item_ids) THEN');
        }
    });
});
