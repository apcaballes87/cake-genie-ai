import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import StickyAddToCartBar from './StickyAddToCartBar';
import {
    STICKY_ADD_TO_CART_AVAILABILITY_OVERLAP_PX,
    STICKY_ADD_TO_CART_AVAILABILITY_VERTICAL_PADDING_PX,
    STICKY_ADD_TO_CART_PRINTOUT_OVERLAP_PX,
} from '@/app/customizing/stickyBarLayout';
import type { PrintoutConversionSummary } from '@/app/customizing/printoutConversion';

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
        const availabilityWrapper = stickyBar?.querySelector('[data-availability-wrapper]');

        expect(availabilityWrapper).toHaveStyle({ marginBottom: `-${STICKY_ADD_TO_CART_AVAILABILITY_OVERLAP_PX}px` });
    });

    it('increases the availability bar vertical padding by the shared height constant', () => {
        const props = buildProps();
        props.availability = 'normal';

        render(<StickyAddToCartBar {...props} />);

        const availability = screen.getByText('Standard order. Receive this by tomorrow');
        const notificationBody = availability.parentElement;

        expect(notificationBody).toHaveStyle({
            paddingTop: '2px',
            paddingBottom: `${STICKY_ADD_TO_CART_AVAILABILITY_VERTICAL_PADDING_PX}px`,
        });
    });

    it('keeps the availability notification layer below the main add-to-cart bar', () => {
        const props = buildProps();
        props.availability = 'same-day';

        const { container } = render(<StickyAddToCartBar {...props} />);

        const stickyBar = container.querySelector('[data-sticky-add-to-cart-bar]');
        const notificationGrid = stickyBar?.querySelector('.grid');
        const mainBar = stickyBar?.querySelector('.backdrop-blur-lg');

        expect(notificationGrid).toHaveClass('relative', 'z-0');
        expect(mainBar).toHaveClass('relative', 'z-10');
    });

    it('renders one combined material-specific printout warning bar', () => {
        const props = buildProps();
        const printoutConversions: PrintoutConversionSummary = { toy: true, ediblePhoto: true, cardstock: true };
        props.printoutConversions = printoutConversions;

        const { container } = render(<StickyAddToCartBar {...props} />);

        const warningText = screen.getByText('Toy, Edible photo, Cardstock changed to printout');
        expect(warningText).toBeDefined();

        const stickyBar = container.querySelector('[data-sticky-add-to-cart-bar]');
        const printoutWrapper = stickyBar?.querySelector('[data-printout-wrapper]');

        expect(printoutWrapper).toHaveStyle({ marginBottom: `-${STICKY_ADD_TO_CART_PRINTOUT_OVERLAP_PX}px` });
    });

    it('does not render a printout warning when the conversion summary is empty', () => {
        const props = buildProps();
        props.printoutConversions = { toy: false, ediblePhoto: false, cardstock: false };

        render(<StickyAddToCartBar {...props} />);

        expect(screen.queryByText(/changed to printout/i)).not.toBeInTheDocument();
    });

    it('announces price changes through the polite status region', () => {
        const props = buildProps();
        const { rerender } = render(<StickyAddToCartBar {...props} />);

        rerender(<StickyAddToCartBar {...props} price={999} />);

        expect(screen.getByRole('status')).toHaveTextContent('Price updated to 999 pesos.');
    });

    it('reports visible unavailability separately and captures a blocked click', () => {
        const props = buildProps();
        const unavailableVisible = vi.fn();
        const blockedClick = vi.fn();
        props.onAddToCartUnavailableVisible = unavailableVisible;
        props.onAddToCartBlockedClick = blockedClick;

        render(<StickyAddToCartBar {...props} isAnalyzing />);

        const addButton = screen.getByRole('button', { name: 'Wait for analysis to finish before buying' });
        expect(addButton).toHaveAttribute('aria-disabled', 'true');
        expect(unavailableVisible).toHaveBeenCalledTimes(1);
        expect(unavailableVisible).toHaveBeenCalledWith('analysis_in_progress');

        fireEvent.click(addButton);
        expect(blockedClick).toHaveBeenCalledTimes(1);
        expect(blockedClick).toHaveBeenCalledWith('analysis_in_progress');
        expect(props.onAddToCartClick).not.toHaveBeenCalled();
    });
});
