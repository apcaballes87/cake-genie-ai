import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import StickyAddToCartBar from './StickyAddToCartBar';

vi.mock('./ShareButton', () => ({
    ShareButton: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>share</button>,
    ChatButton: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>chat</button>,
}));

vi.mock('./DiscountOfferBubble', () => ({
    DiscountOfferBubble: () => null,
}));

beforeAll(() => {
    class ResizeObserverMock {
        observe() { /* noop */ }
        disconnect() { /* noop */ }
        unobserve() { /* noop */ }
    }

    global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});

const buildProps = (): React.ComponentProps<typeof StickyAddToCartBar> => ({
    price: 799,
    isLoading: false,
    isAdding: false,
    error: null,
    onAddToCartClick: vi.fn(),
    onShareClick: vi.fn(),
    onChatClick: undefined,
    isSharing: false,
    canShare: false,
    isAnalyzing: false,
    cakeInfo: null,
    warningMessage: null,
    warningDescription: null,
    onWarningClick: undefined,
    availability: undefined,
    hasPendingDesignChanges: false,
    onApplyChangesClick: vi.fn(),
    isApplyingChanges: false,
    applyChangesLabel: 'Apply Changes',
});

describe('StickyAddToCartBar', () => {
    it('renders the availability bar at the top and ignores warning messages', () => {
        const props = buildProps();
        props.warningMessage = 'Toy is subject for availability';
        props.warningDescription = 'Please message our partner shop for the availability of the toy.';
        props.onWarningClick = vi.fn();
        props.availability = 'normal';

        render(<StickyAddToCartBar {...props} />);

        const warning = screen.queryByText('Toy is subject for availability');
        const availability = screen.getByText('Standard order. Receive this by tomorrow');

        expect(warning).toBeNull();
        expect(availability).toBeDefined();
    });
});
