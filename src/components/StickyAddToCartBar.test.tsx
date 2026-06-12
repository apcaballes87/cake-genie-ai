import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import StickyAddToCartBar from './StickyAddToCartBar';
import {
    STICKY_ADD_TO_CART_AVAILABILITY_OVERLAP_PX,
    STICKY_ADD_TO_CART_AVAILABILITY_VERTICAL_PADDING_PX,
} from '@/app/customizing/stickyBarLayout';

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

    it('pulls the availability bar down by the shared overlap offset', () => {
        const props = buildProps();
        props.availability = 'normal';

        const { container } = render(<StickyAddToCartBar {...props} />);

        const stickyBar = container.querySelector('[data-sticky-add-to-cart-bar]');
        const availabilityWrapper = stickyBar?.querySelector('.grid > div');

        expect(availabilityWrapper).toHaveStyle({ marginBottom: `-${STICKY_ADD_TO_CART_AVAILABILITY_OVERLAP_PX}px` });
    });

    it('increases the availability bar vertical padding by the shared height constant', () => {
        const props = buildProps();
        props.availability = 'normal';

        render(<StickyAddToCartBar {...props} />);

        const availability = screen.getByText('Standard order. Receive this by tomorrow');
        const notificationBody = availability.parentElement;

        expect(notificationBody).toHaveStyle({
            paddingTop: `${STICKY_ADD_TO_CART_AVAILABILITY_VERTICAL_PADDING_PX}px`,
            paddingBottom: `${STICKY_ADD_TO_CART_AVAILABILITY_VERTICAL_PADDING_PX}px`,
        });
    });

    it('nudges the same-day availability text up by 2px without changing the row padding', () => {
        const props = buildProps();
        props.availability = 'same-day';

        render(<StickyAddToCartBar {...props} />);

        const sameDayText = screen.getByText('Same-Day Order! Ready in 3 hours');

        expect(sameDayText).toHaveStyle({
            transform: 'translateY(-2px)',
            display: 'inline-block',
        });
    });
});
