import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI, IcingDesignUI } from '@/types';
import { CustomizingOptionsPanel } from './CustomizingOptionsPanel';

vi.mock('@/components/CakeBaseOptions', () => ({
    CakeBaseOptions: ({
        cakeInfo,
        icingBase,
        isAnalyzing,
        addOnPricing,
    }: {
        cakeInfo: { type?: string | null; size?: string | null } | null;
        icingBase: string | null;
        isAnalyzing: boolean;
        addOnPricing: number;
    }) => (
        <div>
            <span>cake-base-options</span>
            <span>{cakeInfo?.type}</span>
            <span>{cakeInfo?.size}</span>
            <span>{icingBase}</span>
            <span>{isAnalyzing ? 'analyzing' : 'idle'}</span>
            <span>{addOnPricing}</span>
        </div>
    ),
}));

const cakeInfo: CakeInfoUI = {
    type: '1 Tier',
    thickness: '4 in',
    size: '6" Round',
    flavors: ['Chocolate Cake'],
};

const icingDesign: IcingDesignUI = {
    base: 'soft_icing',
    color_type: 'single',
    colors: { side: '#ffffff' },
    border_top: false,
    border_base: false,
    drip: false,
    gumpasteBaseBoard: false,
    dripPrice: 100,
    gumpasteBaseBoardPrice: 100,
};

const buildProps = (): React.ComponentProps<typeof CustomizingOptionsPanel> => ({
    isVisible: true,
    cakeInfo,
    basePriceOptions: [],
    icingDesign,
    onCakeInfoChange: vi.fn(),
    onIcingBaseChange: vi.fn(),
    isAnalyzing: false,
    addOnPricing: 150,
});

describe('CustomizingOptionsPanel', () => {
    it('renders CakeBaseOptions with the current cake info', () => {
        const props = buildProps();

        render(<CustomizingOptionsPanel {...props} />);

        expect(screen.getByText('cake-base-options')).toBeInTheDocument();
        expect(screen.getByText('1 Tier')).toBeInTheDocument();
        expect(screen.getByText('6" Round')).toBeInTheDocument();
        expect(screen.getByText('soft_icing')).toBeInTheDocument();
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
