import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisItem, MainTopperUI, SupportElementUI } from '@/types';
import { CustomizingToppersPanel } from './CustomizingToppersPanel';

vi.mock('@/components/CakeToppersOptions', () => ({
    CakeToppersOptions: ({
        mainToppers,
        supportElements,
        visibleSections,
        isAnalyzing,
        markerMap,
    }: {
        mainToppers: MainTopperUI[];
        supportElements: SupportElementUI[];
        visibleSections?: 'all' | 'main' | 'support';
        isAnalyzing?: boolean;
        markerMap: Map<string, string>;
    }) => (
        <div>
            <span>{mainToppers.length} main toppers</span>
            <span>{supportElements.length} support elements</span>
            <span>{visibleSections ?? 'all'}</span>
            <span>{isAnalyzing ? 'analyzing' : 'ready'}</span>
            <span>{markerMap.size} markers</span>
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
    selectedTopperItem: null,
});

describe('CustomizingToppersPanel', () => {
    it('renders the toppers editor boundary and forwards key props', () => {
        const props = buildProps();

        render(<CustomizingToppersPanel {...props} />);

        expect(screen.getByText('1 main toppers')).toBeInTheDocument();
        expect(screen.getByText('1 support elements')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
        expect(screen.getByText('ready')).toBeInTheDocument();
        expect(screen.getByText('0 markers')).toBeInTheDocument();
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

    it('filters the sheet to only the selected topper item', () => {
        const props = buildProps();
        props.visibleSections = 'all';
        props.mainToppers = [
            props.mainToppers[0],
            {
                id: 'topper-2',
                type: 'figurine',
                original_type: 'figurine',
                description: 'Butterfly topper',
                size: 'small',
                quantity: 1,
                group_id: 'group-3',
                classification: 'hero',
                isEnabled: true,
                price: 0,
            },
        ];
        props.selectedTopperItem = {
            ...props.mainToppers[1],
            itemCategory: 'topper',
        } as Extract<AnalysisItem, { itemCategory: 'topper' }>;

        render(<CustomizingToppersPanel {...props} />);

        expect(screen.getByText('1 main toppers')).toBeInTheDocument();
        expect(screen.getByText('0 support elements')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('filters the sheet to only the selected support element', () => {
        const props = buildProps();
        props.visibleSections = 'all';
        props.supportElements = [
            props.supportElements[0],
            {
                id: 'element-2',
                type: 'fresh_flowers',
                original_type: 'fresh_flowers',
                description: 'Pink flowers',
                size: 'small',
                quantity: 2,
                group_id: 'group-4',
                isEnabled: true,
                price: 0,
            },
        ];
        props.selectedTopperItem = {
            ...props.supportElements[1],
            itemCategory: 'element',
        } as Extract<AnalysisItem, { itemCategory: 'element' }>;

        render(<CustomizingToppersPanel {...props} />);

        expect(screen.getByText('0 main toppers')).toBeInTheDocument();
        expect(screen.getByText('1 support elements')).toBeInTheDocument();
        expect(screen.getByText('support')).toBeInTheDocument();
    });
});
