import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { CartProvider, useCartActions, useCartData } from './CartContext';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    addToCart: vi.fn(),
    addToCartIdempotent: vi.fn(),
    updateCartItemImages: vi.fn(),
}));

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
    createClient: () => ({
        auth: {
            getUser: mocks.getUser,
        },
    }),
}));

vi.mock('@/services/supabaseService', () => ({
    getCartPageData: vi.fn(),
    addToCart: mocks.addToCart,
    addToCartIdempotent: mocks.addToCartIdempotent,
    addManyToCart: vi.fn(),
    updateCartItemQuantity: vi.fn(),
    removeCartItem: vi.fn(),
    updateCartItemImages: mocks.updateCartItemImages,
}));

vi.mock('@/components/ErrorLogger', () => ({ logErrorToSupabase: vi.fn() }));

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

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

function BackgroundUploadProbe() {
    const { cartItems, itemCount } = useCartData();
    const { addToCartWithBackgroundUpload } = useCartActions();
    const upload = deferred<{ originalImageUrl: string; finalImageUrl: string }>();

    return (
        <div>
            <div data-testid="cart-count">{itemCount}</div>
            <div data-testid="pending-state">{cartItems[0]?.isPending ? 'pending' : 'empty'}</div>
            <button
                type="button"
                onClick={() => {
                    addToCartWithBackgroundUpload(
                        {
                            user_id: null,
                            session_id: null,
                            merchant_id: null,
                            product_id: null,
                            cake_type: 'Round',
                            cake_thickness: 'Regular',
                            cake_size: '6 inch',
                            base_price: 1000,
                            addon_price: 0,
                            final_price: 1000,
                            quantity: 1,
                            original_image_url: 'data:image/png;base64,original',
                            customized_image_url: 'data:image/png;base64,custom',
                            customization_details: {},
                        },
                        () => upload.promise
                    );
                }}
            >
                add
            </button>
        </div>
    );
}

describe('CartProvider hydration', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        window.localStorage.clear();
        mocks.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'anonymous-user',
                    is_anonymous: true,
                } as User,
            },
            error: null,
        });
        mocks.addToCart.mockResolvedValue({
            data: {
                cart_item_id: 'real-item',
                user_id: null,
                session_id: 'anonymous-user',
                merchant_id: null,
                product_id: null,
                cake_type: 'Round',
                cake_thickness: 'Regular',
                cake_size: '6 inch',
                base_price: 1000,
                addon_price: 0,
                final_price: 1000,
                quantity: 1,
                original_image_url: 'https://example.com/original.webp',
                customized_image_url: 'https://example.com/custom.webp',
                customization_details: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                expires_at: new Date().toISOString(),
            },
            error: null,
        });
        mocks.addToCartIdempotent.mockResolvedValue({ data: null, error: new Error('network unavailable') });
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

    it('enqueues a pending background-upload item synchronously before auth and upload resolve', async () => {
        const auth = deferred<{ data: { user: User }; error: null }>();
        mocks.getUser.mockReturnValue(auth.promise);

        render(
            <CartProvider>
                <BackgroundUploadProbe />
            </CartProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'add' }));

        expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
        expect(screen.getByTestId('pending-state')).toHaveTextContent('pending');

        auth.resolve({
            data: {
                user: {
                    id: 'anonymous-user',
                    is_anonymous: true,
                } as User,
            },
            error: null,
        });
    });

    it('keeps the cart item visible when durable cart creation fails', async () => {
        render(
            <CartProvider>
                <BackgroundUploadProbe />
            </CartProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'add' }));

        await waitFor(() => {
            expect(mocks.addToCartIdempotent).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
            expect(screen.getByTestId('pending-state')).toHaveTextContent('pending');
        });
    });
});
