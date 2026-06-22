import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCartData } from './CartContext';

vi.mock('next/navigation', () => ({
    usePathname: () => '/',
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        isLoading: false,
    }),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({}),
}));

vi.mock('@/services/supabaseService', () => ({
    getCartPageData: vi.fn(),
    addToCart: vi.fn(),
    addManyToCart: vi.fn(),
    updateCartItemQuantity: vi.fn(),
    removeCartItem: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
    trackAddToCart: vi.fn(),
}));

function writeCartCache(items: Array<Record<string, unknown>>) {
    window.localStorage.setItem(
        'cart_items_cache',
        JSON.stringify({
            value: JSON.stringify(items),
            timestamp: Date.now(),
        })
    );
}

function CartCountProbe({ renderCounts }: { renderCounts: number[] }) {
    const { itemCount } = useCartData();
    renderCounts.push(itemCount);

    return <div data-testid="cart-count">{itemCount}</div>;
}

describe('CartProvider hydration', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    it('keeps the first render SSR-safe before loading cached cart items after mount', async () => {
        const renderCounts: number[] = [];
        writeCartCache([
            {
                cart_item_id: 'cached-item',
                quantity: 2,
                final_price: 1000,
            },
        ]);

        render(
            <CartProvider>
                <CartCountProbe renderCounts={renderCounts} />
            </CartProvider>
        );

        expect(renderCounts[0]).toBe(0);

        await waitFor(() => {
            expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
        });

        expect(renderCounts).toContain(2);
    });
});
