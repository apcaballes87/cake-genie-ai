import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI } from '@/types';
import { CustomizingStepSummarySections } from './CustomizingStepSummarySections';

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

vi.mock('@/components/CakeToppersOptions', () => ({
    CakeToppersOptions: ({ mainToppers, onSectionClick }: { mainToppers: Array<{ id: string }>; onSectionClick?: (section: 'main' | 'support') => void }) => (
        <div>
            <span>{mainToppers.length} toppers</span>
            <button onClick={() => onSectionClick?.('main')}>Open main toppers</button>
        </div>
    ),
}));

const buildProps = (): React.ComponentProps<typeof CustomizingStepSummarySections> => ({
    layout: 'desktop' as const,
    cakeInfo: {
        type: '2 Tier',
        size: '6" Round',
        thickness: '2 in',
        flavors: ['Chocolate Cake'],
    } satisfies CakeInfoUI,
    icingDesign: {
        base: 'soft_icing',
        color_type: 'single',
        drip: true,
        border_top: true,
        border_base: false,
        gumpasteBaseBoard: false,
        colors: {
            drip: '#ff69b4',
            borderTop: '#ff0000',
            borderBase: '#00ff00',
            top: '#ffffff',
            side: '#f5deb3',
            gumpasteBaseBoardColor: '#cccccc',
        },
        dripPrice: 0,
        gumpasteBaseBoardPrice: 0,
    } satisfies IcingDesignUI,
    cakeMessages: [
        {
            id: 'message-1',
            type: 'icing_script',
            position: 'side',
            text: 'Happy Birthday',
            color: '#123456',
            isEnabled: true,
            price: 0,
        },
    ] satisfies CakeMessageUI[],
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
    ] satisfies MainTopperUI[],
    supportElements: [] satisfies SupportElementUI[],
    markerMap: new Map<string, string>(),
    itemPrices: new Map<string, number>(),
    isAdmin: false,
    isAnalyzing: false,
    isRejectionError: false,
    activeCustomization: null,
    selectedItemId: null,
    setActiveCustomization: vi.fn(),
    setSelectedItem: vi.fn(),
    removeCakeMessage: vi.fn(),
    updateMainTopper: vi.fn(),
    updateSupportElement: vi.fn(),
    onTopperImageReplace: vi.fn(),
    onSupportElementImageReplace: vi.fn(),
    openTopperSheet: vi.fn(),
});

describe('CustomizingStepSummarySections', () => {
    it('forwards step-summary interactions for specs, icing, and messages', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /2 Tier/i }));
        fireEvent.click(screen.getByRole('button', { name: /Top Border/i }));
        fireEvent.click(screen.getByText('Happy Birthday'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));

        expect(props.setActiveCustomization).toHaveBeenCalledWith('options');
        expect(props.setActiveCustomization).toHaveBeenCalledWith('icing');
        expect(props.setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'icing-edit-borderTop',
            itemCategory: 'icing',
            cakeType: '2 Tier',
        }));
        expect(props.setActiveCustomization).toHaveBeenCalledWith('messages');
        expect(props.setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'message-1',
            itemCategory: 'message',
            text: 'Happy Birthday',
        }));
        expect(props.removeCakeMessage).toHaveBeenCalledWith('message-1');
        expect(screen.getByText('FRONT')).toBeInTheDocument();
    });

    it('renders empty-message CTA and topper summary actions in mobile layout', () => {
        const props = buildProps();
        props.layout = 'mobile';
        props.cakeMessages = [];

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /Add a cake message/i }));
        fireEvent.click(screen.getByRole('button', { name: /Open main toppers/i }));

        expect(props.setActiveCustomization).toHaveBeenCalledWith('messages');
        expect(props.setSelectedItem).toHaveBeenCalledWith(null);
        expect(props.openTopperSheet).toHaveBeenCalledWith('main');
        expect(screen.getByText('1 toppers')).toBeInTheDocument();
        expect(screen.getByText(/Switch from toy toppers to edible or printed toppers/i)).toBeInTheDocument();
    });
});