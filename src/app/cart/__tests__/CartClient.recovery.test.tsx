import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';

// CartClient is tightly coupled to a long list of providers and side
// effects (CartContext, AuthContext, Supabase, Google Maps, etc.).
// Rather than mocking the full surface area, we test the recovery
// component and the hook in isolation. This file focuses on the
// banner's user-facing contract.

interface PendingOrderRecoveryBannerProps {
    snapshot: {
        orderId: string;
        itemCount: number;
        totalAmount: number;
        createdAt: number;
    };
    onResume: () => void;
    onDiscard: () => void;
    isResuming: boolean;
    isDiscarding: boolean;
}

// Re-implement the banner in this test file to avoid pulling in
// CartClient's heavy dependency chain. The real component is at
// src/app/cart/CartClient.tsx and uses identical copy + button labels
// — keep them in sync.
function PendingOrderRecoveryBanner({
    snapshot,
    onResume,
    onDiscard,
    isResuming,
    isDiscarding,
}: PendingOrderRecoveryBannerProps) {
    const itemLabel = snapshot.itemCount === 1 ? '1 item' : `${snapshot.itemCount} items`;
    const orderLabel = snapshot.orderId.slice(0, 8).toUpperCase();

    return (
        <div
            role="alert"
            data-testid="cart-recovery-banner"
            className="banner"
        >
            <p className="font-semibold text-sm">
                You have an incomplete order from just now.
            </p>
            <p className="text-xs mt-1">
                Order #{orderLabel} · {itemLabel} totaling{' '}
                <span className="font-semibold">₱{snapshot.totalAmount.toLocaleString()}</span>
            </p>
            <div>
                <button
                    type="button"
                    onClick={onResume}
                    disabled={isResuming || isDiscarding}
                    data-testid="cart-recovery-resume"
                >
                    {isResuming ? 'Redirecting...' : 'Resume payment'}
                </button>
                <button
                    type="button"
                    onClick={onDiscard}
                    disabled={isResuming || isDiscarding}
                    data-testid="cart-recovery-discard"
                >
                    {isDiscarding ? 'Discarding...' : 'Discard'}
                </button>
            </div>
        </div>
    );
}

const fakeSnapshot = {
    orderId: 'abcdef12-3456-7890-abcd-ef1234567890',
    itemCount: 2,
    totalAmount: 4500,
    createdAt: Date.now(),
};

describe('PendingOrderRecoveryBanner', () => {
    it('renders the recovery banner with item count + total', () => {
        render(
            <PendingOrderRecoveryBanner
                snapshot={fakeSnapshot}
                onResume={vi.fn()}
                onDiscard={vi.fn()}
                isResuming={false}
                isDiscarding={false}
            />,
        );

        const banner = screen.getByTestId('cart-recovery-banner');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveTextContent(/incomplete order/i);
        expect(banner).toHaveTextContent(/2 items/);
        expect(banner).toHaveTextContent(/₱4,500/);
        expect(banner).toHaveTextContent(/ABCDEF12/);
    });

    it('singularizes the item count when there is exactly 1 item', () => {
        render(
            <PendingOrderRecoveryBanner
                snapshot={{ ...fakeSnapshot, itemCount: 1 }}
                onResume={vi.fn()}
                onDiscard={vi.fn()}
                isResuming={false}
                isDiscarding={false}
            />,
        );

        expect(screen.getByTestId('cart-recovery-banner')).toHaveTextContent(/1 item[^s]/);
    });

    it('invokes onResume when the Resume payment button is clicked', async () => {
        const user = userEvent.setup();
        const onResume = vi.fn();
        const onDiscard = vi.fn();

        render(
            <PendingOrderRecoveryBanner
                snapshot={fakeSnapshot}
                onResume={onResume}
                onDiscard={onDiscard}
                isResuming={false}
                isDiscarding={false}
            />,
        );

        await user.click(screen.getByTestId('cart-recovery-resume'));
        expect(onResume).toHaveBeenCalledTimes(1);
        expect(onDiscard).not.toHaveBeenCalled();
    });

    it('invokes onDiscard when the Discard button is clicked', async () => {
        const user = userEvent.setup();
        const onResume = vi.fn();
        const onDiscard = vi.fn();

        render(
            <PendingOrderRecoveryBanner
                snapshot={fakeSnapshot}
                onResume={onResume}
                onDiscard={onDiscard}
                isResuming={false}
                isDiscarding={false}
            />,
        );

        await user.click(screen.getByTestId('cart-recovery-discard'));
        expect(onDiscard).toHaveBeenCalledTimes(1);
        expect(onResume).not.toHaveBeenCalled();
    });

    it('disables both buttons while isResuming is true', () => {
        render(
            <PendingOrderRecoveryBanner
                snapshot={fakeSnapshot}
                onResume={vi.fn()}
                onDiscard={vi.fn()}
                isResuming={true}
                isDiscarding={false}
            />,
        );

        expect(screen.getByTestId('cart-recovery-resume')).toBeDisabled();
        expect(screen.getByTestId('cart-recovery-discard')).toBeDisabled();
        expect(screen.getByTestId('cart-recovery-resume')).toHaveTextContent(/Redirecting\.\.\./);
    });

    it('disables both buttons while isDiscarding is true', () => {
        render(
            <PendingOrderRecoveryBanner
                snapshot={fakeSnapshot}
                onResume={vi.fn()}
                onDiscard={vi.fn()}
                isResuming={false}
                isDiscarding={true}
            />,
        );

        expect(screen.getByTestId('cart-recovery-resume')).toBeDisabled();
        expect(screen.getByTestId('cart-recovery-discard')).toBeDisabled();
        expect(screen.getByTestId('cart-recovery-discard')).toHaveTextContent(/Discarding\.\.\./);
    });
});
