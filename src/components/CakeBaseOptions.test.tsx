import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI } from '@/types';
import { CakeBaseOptions } from './CakeBaseOptions';

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    value: vi.fn(),
    writable: true,
});

const baseCakeInfo: CakeInfoUI = {
    type: '1 Tier',
    thickness: '4 in',
    size: '6" Round',
    flavors: ['Chocolate Cake'],
};

const buildProps = (overrides?: Partial<React.ComponentProps<typeof CakeBaseOptions>>): React.ComponentProps<typeof CakeBaseOptions> => ({
    cakeInfo: baseCakeInfo,
    basePriceOptions: [
        { size: '6" Round', price: 1099 },
        { size: '8" Round', price: 1499 },
    ],
    icingBase: 'soft_icing',
    onCakeInfoChange: vi.fn(),
    onIcingBaseChange: vi.fn(),
    isAnalyzing: false,
    addOnPricing: 0,
    ...overrides,
});

describe('CakeBaseOptions', () => {
    it('shows the soft icing cake types, including bento', () => {
        render(<CakeBaseOptions {...buildProps()} />);

        expect(screen.getAllByText('Bento').length).toBeGreaterThan(0);
        expect(screen.getAllByText('1 Tier (Soft icing)').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2 Tier (Soft icing)').length).toBeGreaterThan(0);
        expect(screen.getAllByText('3 Tier (Soft icing)').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Square').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Rectangle').length).toBeGreaterThan(0);
        expect(screen.queryByText('1 Tier Fondant')).not.toBeInTheDocument();
        expect(screen.queryByText('Square Fondant')).not.toBeInTheDocument();
    });

    it('shows only fondant cake types when fondant is selected', () => {
        render(<CakeBaseOptions {...buildProps({
            cakeInfo: {
                ...baseCakeInfo,
                type: '1 Tier Fondant',
                thickness: '5 in',
            },
            icingBase: 'fondant',
        })} />);

        expect(screen.getAllByText('1 Tier Fondant').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2 Tier Fondant').length).toBeGreaterThan(0);
        expect(screen.getAllByText('3 Tier Fondant').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Square Fondant').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Rectangle Fondant').length).toBeGreaterThan(0);
        expect(screen.queryByText('Bento')).not.toBeInTheDocument();
        expect(screen.queryByText('1 Tier (Soft icing)')).not.toBeInTheDocument();
    });

    it('forwards icing type changes from the new selector', () => {
        const onIcingBaseChange = vi.fn();

        render(<CakeBaseOptions {...buildProps({ onIcingBaseChange })} />);

        fireEvent.click(screen.getByRole('radio', { name: /Fondant/i }));

        expect(onIcingBaseChange).toHaveBeenCalledWith('fondant');
    });

    it('exposes cake size choices as radios with the current selection checked', () => {
        render(<CakeBaseOptions {...buildProps()} />);

        expect(screen.getByRole('radio', { name: /6" Round/i })).toBeChecked();
        expect(screen.getByRole('radio', { name: /8" Round/i })).not.toBeChecked();
    });

    it('can render only a single section for focused popup editing', () => {
        render(<CakeBaseOptions {...buildProps({
            visibleSections: ['size'],
            showSectionLabels: false,
        })} />);

        expect(screen.getAllByText('6" Round').length).toBeGreaterThan(0);
        expect(screen.queryByText('Icing Type')).not.toBeInTheDocument();
        expect(screen.queryByText('Cake Type')).not.toBeInTheDocument();
        expect(screen.queryByText('Cake Height (All tiers)')).not.toBeInTheDocument();
    });

    it('hides icing type and height options for cupcakes', () => {
        render(<CakeBaseOptions {...buildProps({
            cakeInfo: {
                type: 'Cupcake',
                thickness: '2 in',
                size: '2oz - 12 pieces',
                flavors: ['Chocolate Cake'],
            },
        })} />);

        expect(screen.queryByText('Icing Type')).not.toBeInTheDocument();
        expect(screen.queryByText('Cake Height (All tiers)')).not.toBeInTheDocument();
        expect(screen.queryByText('Height per Cake')).not.toBeInTheDocument();
    });
});
