'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CakeGenieCartItem } from '@/lib/database.types';

export const PENDING_PAYMENT_ORDER_ID_KEY = 'pending_payment_order_id';
export const PENDING_PAYMENT_CART_KEY = 'pending_payment_cart';
export const PENDING_PAYMENT_GUEST_EMAIL_KEY = 'pending_payment_guest_email';

export const pendingPaymentDismissedKey = (orderId: string) =>
    `pending_payment_dismissed_for_${orderId}`;

export interface PendingOrderSnapshot {
    orderId: string;
    cartItems: CakeGenieCartItem[];
    itemCount: number;
    totalAmount: number;
    createdAt: number; // Date.now() when the snapshot was first observed
    autoRestore: boolean; // true when triggered via ?payment_failed=true
}

interface UsePendingOrderRecoveryApi {
    recoveryBanner: PendingOrderSnapshot | null;
    dismiss: () => void;
    clearSnapshot: () => void;
    acceptAutoRestore: () => PendingOrderSnapshot | null;
    isHydrated: boolean;
}

const computeItemCount = (items: CakeGenieCartItem[]): number =>
    items.reduce((total, item) => total + (item.quantity ?? 1), 0);

const computeTotalAmount = (items: CakeGenieCartItem[]): number =>
    items.reduce(
        (total, item) => total + (item.final_price ?? 0) * (item.quantity ?? 1),
        0,
    );

/**
 * usePendingOrderRecovery
 *
 * Detects a pending-but-unpaid order left over from a Xendit redirect.
 * The checkout flow writes a sessionStorage snapshot
 * (`pending_payment_order_id` + `pending_payment_cart`) right before
 * redirecting to Xendit. When the user comes back (either via the
 * explicit failure URL with `?payment_failed=true&order_id=...` or via
 * the plain browser back button) this hook surfaces a banner so the
 * user can resume payment or discard the order.
 *
 * The user is in control: we never auto-restore cart items. For the
 * `?payment_failed=true` path, intent is unambiguous so the caller
 * may opt into an inline toast via `acceptAutoRestore()`.
 */
export function usePendingOrderRecovery(args: {
    paymentFailed: boolean;
    paymentFailedOrderId: string | null;
}): UsePendingOrderRecoveryApi {
    const { paymentFailed, paymentFailedOrderId } = args;
    const [recoveryBanner, setRecoveryBanner] = useState<PendingOrderSnapshot | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    const readSnapshot = useCallback((): PendingOrderSnapshot | null => {
        if (typeof window === 'undefined') return null;
        const orderId = window.sessionStorage.getItem(PENDING_PAYMENT_ORDER_ID_KEY);
        const cartJson = window.sessionStorage.getItem(PENDING_PAYMENT_CART_KEY);
        if (!orderId || !cartJson) return null;

        let parsed: unknown;
        try {
            parsed = JSON.parse(cartJson);
        } catch {
            return null;
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return null;

        // Already dismissed in this session? Skip.
        if (window.sessionStorage.getItem(pendingPaymentDismissedKey(orderId)) === '1') {
            return null;
        }

        const cartItems = parsed as CakeGenieCartItem[];
        return {
            orderId,
            cartItems,
            itemCount: computeItemCount(cartItems),
            totalAmount: computeTotalAmount(cartItems),
            createdAt: Date.now(),
            autoRestore: false,
        };
    }, []);

    // Initial mount + `pageshow` (fires on browser back in some browsers).
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const hydrate = () => {
            const snap = readSnapshot();
            if (snap) {
                if (paymentFailed) {
                    // The Xendit failure URL flips the auto-restore intent.
                    setRecoveryBanner({ ...snap, autoRestore: true });
                } else {
                    setRecoveryBanner(snap);
                }
            } else if (paymentFailed && paymentFailedOrderId) {
                // The failure URL pointed at an order whose snapshot we
                // don't have (or that the user already dismissed). We
                // still want to surface the inline restore toast so the
                // user knows the payment didn't complete, but with no
                // snapshot we can only show the order id.
                setRecoveryBanner({
                    orderId: paymentFailedOrderId,
                    cartItems: [],
                    itemCount: 0,
                    totalAmount: 0,
                    createdAt: Date.now(),
                    autoRestore: true,
                });
            }
            setIsHydrated(true);
        };

        hydrate();
        window.addEventListener('pageshow', hydrate);
        return () => {
            window.removeEventListener('pageshow', hydrate);
        };
    }, [paymentFailed, paymentFailedOrderId, readSnapshot]);

    const dismiss = useCallback(() => {
        if (!recoveryBanner) return;
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(
                pendingPaymentDismissedKey(recoveryBanner.orderId),
                '1',
            );
        }
        setRecoveryBanner(null);
    }, [recoveryBanner]);

    const clearSnapshot = useCallback(() => {
        if (typeof window === 'undefined') return;
        window.sessionStorage.removeItem(PENDING_PAYMENT_ORDER_ID_KEY);
        window.sessionStorage.removeItem(PENDING_PAYMENT_CART_KEY);
        window.sessionStorage.removeItem(PENDING_PAYMENT_GUEST_EMAIL_KEY);
    }, []);

    const acceptAutoRestore = useCallback((): PendingOrderSnapshot | null => {
        if (!recoveryBanner) return null;
        const snap = recoveryBanner;
        clearSnapshot();
        setRecoveryBanner(null);
        return snap;
    }, [recoveryBanner, clearSnapshot]);

    return {
        recoveryBanner,
        dismiss,
        clearSnapshot,
        acceptAutoRestore,
        isHydrated,
    };
}
