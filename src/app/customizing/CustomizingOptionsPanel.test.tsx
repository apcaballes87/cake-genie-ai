import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI } from '@/types';
import { CustomizingOptionsPanel } from './CustomizingOptionsPanel';

vi.mock('@/components/CakeBaseOptions', () => ({
    CakeBaseOptions: ({
        cakeInfo,
        isAnalyzing,
        addOnPricing,
    }: {
        cakeInfo: { type?: string | null; size?: string | null } | null;
        isAnalyzing: boolean;
        addOnPricing: number;
    }) => (
        <div>
            <span>cake-base-options</span>
            <span>{cakeInfo?.type}</span>
            <span>{cakeInfo?.size}</span>
            <span>{isAnalyzing ? 'analyzing' : 'idle'}</span>
            <span>{addOnPricing}</span>
        </div>
    ),
}));

const cakeInfo: CakeInfoUI = {
    type: '1 Tier',
    size: '6x3',
    shape: 'round',
    servings: '12',
    frosting_type: 'buttercream',
    flavor: 'chocolate',
    has_drip: false,
    has_border: false,
};

const buildProps = (): React.ComponentProps<typeof CustomizingOptionsPanel> => ({
    isVisible: true,
    cakeInfo,
    basePriceOptions: [],
    onCakeInfoChange: vi.fn(),
    isAnalyzing: false,
    addOnPricing: 150,
});

describe('CustomizingOptionsPanel', () => {
    it('renders CakeBaseOptions with the current cake info', () => {
        const props = buildProps();

        render(<CustomizingOptionsPanel {...props} />);

        expect(screen.getByText('cake-base-options')).toBeInTheDocument();
        expect(screen.getByText('1 Tier')).toBeInTheDocument();
        expect(screen.getByText('6x3')).toBeInTheDocument();
        expect(screen.getByText('idle')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('renders an empty hidden wrapper when no cake info is available', () => {
        const props = buildProps();
        props.isVisible = false;
        props.cakeInfo = null;

        const { container } = render(<CustomizingOptionsPanel {...props} />);

        expect(container.firstChild).toHaveClass('hidden');
        expect(screen.queryByText('cake-base-options')).not.toBeInTheDocument();
    });
});