import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MainTopperUI, SupportElementUI } from '@/types';
import { CustomizingToppersPanel } from './CustomizingToppersPanel';

vi.mock('@/components/CakeToppersOptions', () => ({
    CakeToppersOptions: ({
        mainToppers,
        supportElements,
        visibleSections,
        isAnalyzing,
    }: {
        mainToppers: MainTopperUI[];
        supportElements: SupportElementUI[];
        visibleSections?: 'all' | 'main' | 'support';
        isAnalyzing?: boolean;
    }) => (
        <div>
            <span>{mainToppers.length} main toppers</span>
            <span>{supportElements.length} support elements</span>
            <span>{visibleSections ?? 'all'}</span>
            <span>{isAnalyzing ? 'analyzing' : 'ready'}</span>
        </div>
    ),
}));

const buildProps = (): React.ComponentProps<typeof CustomizingToppersPanel> => ({
    isVisible: true,
    mainToppers: [
        {
            id: 'topper-1',
            type: 'toy',
            original_type: 'toy',
            description: 'Toy topper',
            size: 'medium',
            quantity: 1,
            group_id: 'group-1',
            classification: 'hero',
            isEnabled: true,
            price: 0,
        },
    ],
    supportElements: [
        {
            id: 'element-1',
            type: 'chocolates',
            original_type: 'chocolates',
            description: 'Chocolate accents',
            size: 'small',
            quantity: 1,
            group_id: 'group-2',
            classification: 'accessory',
            isEnabled: true,
            price: 0,
        },
    ],
    markerMap: new Map(),
    updateMainTopper: vi.fn(),
    updateSupportElement: vi.fn(),
    onTopperImageReplace: vi.fn(),
    onSupportElementImageReplace: vi.fn(),
    itemPrices: new Map(),
    isAdmin: false,
    isAnalyzing: false,
    visibleSections: 'main',
});

describe('CustomizingToppersPanel', () => {
    it('renders the toppers editor boundary and forwards key props', () => {
        const props = buildProps();

        render(<CustomizingToppersPanel {...props} />);

        expect(screen.getByText('1 main toppers')).toBeInTheDocument();
        expect(screen.getByText('1 support elements')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText('ready')).toBeInTheDocument();
    });

    it('keeps the wrapper hidden when the panel is not active', () => {
        const props = buildProps();
        props.isVisible = false;
        props.visibleSections = 'support';
        props.isAnalyzing = true;

        const { container } = render(<CustomizingToppersPanel {...props} />);

        expect(container.firstChild).toHaveClass('hidden');
        expect(screen.getByText('support')).toBeInTheDocument();
        expect(screen.getByText('analyzing')).toBeInTheDocument();
    });
});