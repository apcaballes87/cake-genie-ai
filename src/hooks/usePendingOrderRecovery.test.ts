import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    PENDING_PAYMENT_CART_KEY,
    PENDING_PAYMENT_GUEST_EMAIL_KEY,
    PENDING_PAYMENT_ORDER_ID_KEY,
    pendingPaymentDismissedKey,
    usePendingOrderRecovery,
} from './usePendingOrderRecovery';
import type { CakeGenieCartItem } from '@/lib/database.types';

const FAKE_ORDER_ID = 'order-abc-123';

const makeItem = (overrides: Partial<CakeGenieCartItem> = {}): CakeGenieCartItem => ({
    cart_item_id: 'cart-1',
    user_id: null,
    session_id: 'session-1',
    merchant_id: null,
    product_id: null,
    cake_type: '1 Tier',
    cake_thickness: 'Regular',
    cake_size: '8" Round',
    base_price: 1000,
    addon_price: 0,
    final_price: 1000,
    quantity: 1,
    original_image_url: '',
    customized_image_url: '',
    customization_details: {} as never,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date().toISOString(),
    ...overrides,
});

const seedSnapshot = (items: CakeGenieCartItem[] = [makeItem()]) => {
    window.sessionStorage.setItem(PENDING_PAYMENT_ORDER_ID_KEY, FAKE_ORDER_ID);
    window.sessionStorage.setItem(PENDING_PAYMENT_CART_KEY, JSON.stringify(items));
    window.sessionStorage.setItem(PENDING_PAYMENT_GUEST_EMAIL_KEY, 'guest@example.com');
};

describe('usePendingOrderRecovery', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    afterEach(() => {
        window.sessionStorage.clear();
    });

    it('returns no banner when sessionStorage has no pending snapshot', () => {
        const { result } = renderHook(() =>
            usePendingOrderRecovery({ paymentFailed: false, paymentFailedOrderId: null }),
        );

        expect(result.current.recoveryBanner).toBeNull();
        expect(result.current.isHydrated).toBe(true);
    });

    it('surfaces a recovery banner from the sessionStorage snapshot on mount', () => {
        const items = [makeItem({ final_price: 1500, quantity: 2 })];
        seedSnapshot(items);

        const { result } = renderHook(() =>
            usePendingOrderRecovery({ paymentFailed: false, paymentFailedOrderId: null }),
        );

        expect(result.current.recoveryBanner).toMatchObject({
            orderId: FAKE_ORDER_ID,
            itemCount: 2,
            totalAmount: 3000,
            autoRestore: false,
        });
    });

    it('marks the banner with autoRestore=true when ?payment_failed=true is present', () => {
        seedSnapshot();

        const { result } = renderHook(() =>
            usePendingOrderRecovery({
                paymentFailed: true,
                paymentFailedOrderId: FAKE_ORDER_ID,
            }),
        );

        expect(result.current.recoveryBanner?.autoRestore).toBe(true);
        expect(result.current.recoveryBanner?.orderId).toBe(FAKE_ORDER_ID);
    });

    it('still surfaces a synthetic banner on the payment_failed path even if the snapshot is gone', () => {
        const { result } = renderHook(() =>
            usePendingOrderRecovery({
                paymentFailed: true,
                paymentFailedOrderId: FAKE_ORDER_ID,
            }),
        );

        expect(result.current.recoveryBanner).toMatchObject({
            orderId: FAKE_ORDER_ID,
            autoRestore: true,
            itemCount: 0,
            totalAmount: 0,
        });
    });

    it('does not surface a banner that the user dismissed earlier in the session', () => {
        seedSnapshot();
        window.sessionStorage.setItem(pendingPaymentDismissedKey(FAKE_ORDER_ID), '1');

        const { result } = renderHook(() =>
            usePendingOrderRecovery({ paymentFailed: false, paymentFailedOrderId: null }),
        );

        expect(result.current.recoveryBanner).toBeNull();
    });

    it('dismiss() hides the banner and persists the dismissed flag for the order', () => {
        seedSnapshot();

        const { result } = renderHook(() =>
            usePendingOrderRecovery({ paymentFailed: false, paymentFailedOrderId: null }),
        );

        expect(result.current.recoveryBanner).not.toBeNull();

        act(() => {
            result.current.dismiss();
        });

        expect(result.current.recoveryBanner).toBeNull();
        expect(window.sessionStorage.getItem(pendingPaymentDismissedKey(FAKE_ORDER_ID))).toBe('1');
    });

    it('clearSnapshot() removes the pending order + cart + guest email from sessionStorage', () => {
        seedSnapshot();

        const { result } = renderHook(() =>
            usePendingOrderRecovery({ paymentFailed: false, paymentFailedOrderId: null }),
        );

        act(() => {
            result.current.clearSnapshot();
        });

        expect(window.sessionStorage.getItem(PENDING_PAYMENT_ORDER_ID_KEY)).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_PAYMENT_CART_KEY)).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_PAYMENT_GUEST_EMAIL_KEY)).toBeNull();
    });

    it('acceptAutoRestore() returns the snapshot, clears sessionStorage, and hides the banner', () => {
        const items = [makeItem({ final_price: 750, quantity: 1 })];
        seedSnapshot(items);

        const { result } = renderHook(() =>
            usePendingOrderRecovery({
                paymentFailed: true,
                paymentFailedOrderId: FAKE_ORDER_ID,
            }),
        );

        let restored: ReturnType<typeof result.current.acceptAutoRestore> = null;
        act(() => {
            restored = result.current.acceptAutoRestore();
        });

        // We expect the recovery to have happened. `restored` is the
        // hook's return value, typed as `PendingOrderSnapshot | null`.
        expect(restored).toMatchObject({
            orderId: FAKE_ORDER_ID,
            totalAmount: 750,
        });
        expect(result.current.recoveryBanner).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_PAYMENT_CART_KEY)).toBeNull();
    });

    it('ignores malformed cart JSON in sessionStorage', () => {
        window.sessionStorage.setItem(PENDING_PAYMENT_ORDER_ID_KEY, FAKE_ORDER_ID);
        window.sessionStorage.setItem(PENDING_PAYMENT_CART_KEY, 'not-json');

        const { result } = renderHook(() =>
            usePendingOrderRecovery({ paymentFailed: false, paymentFailedOrderId: null }),
        );

        expect(result.current.recoveryBanner).toBeNull();
    });
});
