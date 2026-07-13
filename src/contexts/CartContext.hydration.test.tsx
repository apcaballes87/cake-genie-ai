import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { CartProvider, cleanupExpiredLocalStorage, useCartActions, useCartData } from './CartContext';

const mocks = vi.hoisted(() => ({
    authUser: null as User | null,
    pathname: '/',
    getUser: vi.fn(),
    getCartPageData: vi.fn(),
    addToCart: vi.fn(),
    addToCartIdempotent: vi.fn(),
    updateCartItemImages: vi.fn(),
    claimCartAuthTransfer: vi.fn(),
    getPendingCartAuthTransfer: vi.fn(),
    clearPendingCartAuthTransfer: vi.fn(),
    getCartOutbox: vi.fn(),
    putCartOutbox: vi.fn(),
    removeCartOutbox: vi.fn(),
    reassignCartOutboxOwner: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => mocks.pathname,
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: mocks.authUser,
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
    getCartPageData: mocks.getCartPageData,
    addToCart: mocks.addToCart,
    addToCartIdempotent: mocks.addToCartIdempotent,
    updateCartItemQuantity: vi.fn(),
    removeCartItem: vi.fn(),
    updateCartItemImages: mocks.updateCartItemImages,
}));

vi.mock('@/lib/cartAuthTransfer', () => ({
    CART_RETENTION_DAYS: 30,
    claimCartAuthTransfer: mocks.claimCartAuthTransfer,
    getPendingCartAuthTransfer: mocks.getPendingCartAuthTransfer,
    clearPendingCartAuthTransfer: mocks.clearPendingCartAuthTransfer,
}));

vi.mock('@/lib/cartOutbox', () => ({
    getCartOutbox: mocks.getCartOutbox,
    putCartOutbox: mocks.putCartOutbox,
    removeCartOutbox: mocks.removeCartOutbox,
    reassignCartOutboxOwner: mocks.reassignCartOutboxOwner,
    withCartOutboxRecordLock: vi.fn(async (_cartItemId: string, task: () => Promise<unknown>) => task()),
}));

vi.mock('@/components/ErrorLogger', () => ({ logErrorToSupabase: vi.fn() }));

vi.mock('@/lib/analytics', () => ({
    trackAddToCart: vi.fn(),
    trackCartPersistenceStage: vi.fn(),
    trackEvent: vi.fn(),
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
        mocks.authUser = null;
        mocks.pathname = '/';
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
        mocks.getPendingCartAuthTransfer.mockReturnValue(null);
        mocks.getCartOutbox.mockResolvedValue([]);
        mocks.putCartOutbox.mockResolvedValue(undefined);
        mocks.removeCartOutbox.mockResolvedValue(undefined);
        mocks.reassignCartOutboxOwner.mockResolvedValue(0);
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

    it('claims the cart before the first registered fetch after a Google OAuth remount', async () => {
        const guestItem = {
            cart_item_id: 'guest-item',
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
            expires_at: new Date(Date.now() + 60_000).toISOString(),
        };
        const registeredItem = { ...guestItem, user_id: 'registered-user', session_id: null };

        mocks.pathname = '/cart';
        mocks.authUser = { id: 'registered-user', is_anonymous: false } as User;
        writeCartCache([guestItem]);
        const claim = deferred<{
            data: { sourceAnonymousUserId: string; updatedCount: number; alreadyClaimed: boolean };
            error: null;
        }>();
        mocks.getPendingCartAuthTransfer.mockReturnValue({
            token: 'a'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
        mocks.claimCartAuthTransfer.mockReturnValue(claim.promise);
        mocks.getCartPageData.mockImplementation(async (userId: string | null, sessionId: string | null) => ({
            cartData: {
                data: [userId ? registeredItem : { ...guestItem, session_id: sessionId }],
                error: null,
            },
            addressesData: { data: [], error: null },
        }));

        render(
            <CartProvider>
                <CartCountProbe renderCounts={[]} />
            </CartProvider>
        );

        await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('1'));
        await waitFor(() => expect(mocks.claimCartAuthTransfer).toHaveBeenCalledTimes(1));
        expect(mocks.getCartPageData).not.toHaveBeenCalled();

        claim.resolve({
            data: {
                sourceAnonymousUserId: 'anonymous-user',
                updatedCount: 1,
                alreadyClaimed: false,
            },
            error: null,
        });

        await waitFor(() => {
            expect(mocks.reassignCartOutboxOwner).toHaveBeenCalledWith('anonymous-user', 'registered-user');
            expect(mocks.getCartPageData).toHaveBeenCalledWith('registered-user', null);
            expect(mocks.clearPendingCartAuthTransfer).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
        });
    });

    it('does not fetch or clear the cached cart when the OAuth claim fails', async () => {
        const guestItem = {
            cart_item_id: 'guest-item',
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
            expires_at: new Date(Date.now() + 60_000).toISOString(),
        };

        mocks.pathname = '/cart';
        mocks.authUser = { id: 'registered-user', is_anonymous: false } as User;
        writeCartCache([guestItem]);
        mocks.getPendingCartAuthTransfer.mockReturnValue({
            token: 'a'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
        mocks.claimCartAuthTransfer.mockResolvedValue({
            data: null,
            error: new Error('expired'),
        });

        render(
            <CartProvider>
                <CartCountProbe renderCounts={[]} />
            </CartProvider>
        );

        await waitFor(() => expect(mocks.claimCartAuthTransfer).toHaveBeenCalledTimes(1));
        expect(mocks.getCartPageData).not.toHaveBeenCalled();
        expect(mocks.clearPendingCartAuthTransfer).not.toHaveBeenCalled();
        expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
    });

    it('keeps local cart cache for 30 days and removes it after that', () => {
        const now = Date.now();
        window.localStorage.setItem('cart_items_cache', JSON.stringify({ value: 'recent', timestamp: now - 29 * 24 * 60 * 60 * 1000 }));
        window.localStorage.setItem('cart_event_date', JSON.stringify({ value: 'old', timestamp: now - 31 * 24 * 60 * 60 * 1000 }));

        cleanupExpiredLocalStorage();

        expect(window.localStorage.getItem('cart_items_cache')).not.toBeNull();
        expect(window.localStorage.getItem('cart_event_date')).toBeNull();
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
