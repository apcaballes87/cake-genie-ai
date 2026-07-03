import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI } from '@/types';
import { CustomizingStepSummarySections } from './CustomizingStepSummarySections';

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    value: vi.fn(),
    writable: true,
});

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    writable: true,
});

Object.defineProperty(window, 'requestAnimationFrame', {
    value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
    },
    writable: true,
});

Object.defineProperty(window, 'cancelAnimationFrame', {
    value: vi.fn(),
    writable: true,
});

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
            side: '#f5deb3',
            top: '#ffffff',
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
    basePriceOptions: [
        { size: '6" Round', price: 1099 },
        { size: '8" Round', price: 1499 },
    ],
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
    onCakeInfoChange: vi.fn(),
    onIcingTypeChange: vi.fn(),
    addOnPricing: 0,
});

describe('CustomizingStepSummarySections', () => {
    it('keeps cake type controls in advanced customization and still forwards message actions', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.queryByRole('button', { name: /3 Tier/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Edit Design Details/i }));
        fireEvent.click(screen.getByRole('button', { name: /3 Tier/i }));
        fireEvent.click(screen.getByText('Happy Birthday'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));

        expect(props.onCakeInfoChange).toHaveBeenCalledWith({ type: '3 Tier' });
        expect(props.setActiveCustomization).toHaveBeenCalledWith('messages');
        expect(props.setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'message-1',
            itemCategory: 'message',
            text: 'Happy Birthday',
        }));
        expect(props.removeCakeMessage).toHaveBeenCalledWith('message-1');
        expect(screen.getByText('FRONT')).toBeInTheDocument();
        expect(screen.queryByText('Choose Cake Type')).not.toBeInTheDocument();
    });

    it('opens the icing popup and forwards icing-type changes', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /Soft Icing/i }));

        fireEvent.click(screen.getAllByText('Fondant')[0]);

        expect(props.onIcingTypeChange).toHaveBeenCalledWith('fondant');
    });

    it('does not mix icing thumbnails into the default cake options step', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.queryByRole('button', { name: /Top Border/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Top Icing/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Body Icing/i })).not.toBeInTheDocument();
    });

    it('renders empty-message CTA and combined decoration summary in mobile layout', () => {
        const props = buildProps();
        props.layout = 'mobile';
        props.cakeMessages = [];

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /Add a cake message/i }));
        fireEvent.click(screen.getByRole('button', { name: /Edit Design Details/i }));
        fireEvent.click(screen.getByRole('button', { name: /Toy topper\s*\(Toy\)/i }));

        expect(props.setActiveCustomization).toHaveBeenCalledWith('messages');
        expect(props.setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'topper-1',
            itemCategory: 'topper',
            description: 'Toy topper',
        }));
        expect(props.openTopperSheet).toHaveBeenCalledWith('main');
        expect(screen.getByRole('button', { name: /Toy topper\s*\(Toy\)/i })).toBeInTheDocument();
        expect(screen.getByText(/Switch from toy toppers to edible or printed toppers/i)).toBeInTheDocument();
    });

    it('shows only the first 3 decoration items and uses show more for overflow', () => {
        const props = buildProps();
        props.mainToppers = [
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
            {
                id: 'topper-2',
                type: 'figurine',
                original_type: 'figurine',
                description: 'Butterfly topper',
                size: 'small',
                quantity: 1,
                group_id: 'group-1',
                classification: 'hero',
                isEnabled: true,
                price: 0,
            },
        ] as MainTopperUI[];
        props.supportElements = [
            {
                id: 'support-1',
                type: 'fresh_flowers',
                original_type: 'fresh_flowers',
                description: 'Pink flowers',
                size: 'small',
                quantity: 2,
                group_id: 'group-2',
                isEnabled: true,
                price: 0,
            },
            {
                id: 'support-2',
                type: 'dragees',
                original_type: 'dragees',
                description: 'Sugar pearls',
                size: 'small',
                quantity: 1,
                group_id: 'group-3',
                isEnabled: true,
                price: 0,
            },
        ] as SupportElementUI[];

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /Edit Design Details/i }));

        expect(screen.getByRole('button', { name: /Toy topper\s*\(Toy\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Butterfly topper\s*\(Figurine \(Simpler\)\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Pink flowers\s*\(Fresh Flowers\)/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Sugar pearls\s*\(Dragees \(Pearls\)\)/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Show more/i }));

        expect(props.setSelectedItem).toHaveBeenCalledWith(null);
        expect(props.openTopperSheet).toHaveBeenCalledWith();
    });

    it('keeps the decoration step visible even when no toppers or support elements were detected', () => {
        const props = buildProps();
        props.mainToppers = [];
        props.supportElements = [];

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.getByText(/No decorations detected yet/i)).toBeInTheDocument();
        expect(screen.queryByText(/Switch from toy toppers to edible or printed toppers/i)).not.toBeInTheDocument();
    });

    it('splits icing into its own step when requested', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} separateIcingStep />);

        expect(screen.getByRole('button', { name: /Top Border/i })).toBeInTheDocument();
    });

    it('renders AI chat above cake options while keeping cake type controls inside advanced customization', () => {
        const props = buildProps();
        props.aiChatNode = <div>AI Cake Assistant</div>;

        render(<CustomizingStepSummarySections {...props} />);

        // Open the floating color picker
        const softIcingBtn = screen.getByRole('button', { name: /Soft Icing/i });
        fireEvent.click(softIcingBtn);

        const advancedToggle = screen.getByRole('button', { name: /Edit Design Details/i });
        const advancedSection = document.getElementById('advanced-customization-steps');
        const icingTypeLabel = screen.getByText('Icing Type');
        const mainLabel = screen.getByText('Main');
        const aiChatTitle = screen.getByText('AI Cake Assistant');

        expect(icingTypeLabel.compareDocumentPosition(mainLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(aiChatTitle.compareDocumentPosition(icingTypeLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByTitle('red')).toBeInTheDocument();
        expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
        expect(advancedSection).toHaveClass('max-h-0', 'opacity-0', 'pointer-events-none');
        expect(within(advancedSection as HTMLElement).queryByText('Main')).not.toBeInTheDocument();
        expect(within(advancedSection as HTMLElement).queryByText('AI Cake Assistant')).not.toBeInTheDocument();

        fireEvent.click(advancedToggle);

        expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');
        expect(advancedSection).toHaveClass('max-h-[2000px]', 'opacity-100');
        const advancedScope = within(advancedSection as HTMLElement);
        const cakeTypeLabel = advancedScope.getByText('Cake Type');

        expect(advancedScope.queryByText('AI Cake Assistant')).not.toBeInTheDocument();
        expect(advancedScope.getByRole('button', { name: /2 Tier/i })).toBeInTheDocument();
        expect(advancedScope.getByRole('button', { name: /3 Tier/i })).toBeInTheDocument();
        expect(cakeTypeLabel).toBeInTheDocument();
    });

    it('calls onDisableMask and onUpdateDesign when (fix icing color) button is clicked', () => {
        const props = buildProps();
        props.onDisableMask = vi.fn();
        props.onUpdateDesign = vi.fn();
        props.isMaskActive = true;

        render(<CustomizingStepSummarySections {...props} />);

        // Open the floating color picker
        const softIcingBtn = screen.getByRole('button', { name: /Soft Icing/i });
        fireEvent.click(softIcingBtn);

        // Click the "Fix Icing Color" button
        const fixBtn = screen.getByRole('button', { name: /Fix Icing Color/i });
        fireEvent.click(fixBtn);

        expect(props.onDisableMask).toHaveBeenCalled();
        expect(props.onUpdateDesign).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({ hex: '#f5deb3' })
        );
    });

    it('scrolls the desktop sidebar container to reveal advanced cards when opened', async () => {
        const props = buildProps();

        render(
            <div data-testid="scroll-parent" style={{ overflowY: 'auto', maxHeight: '220px' }}>
                <CustomizingStepSummarySections {...props} />
            </div>,
        );

        const scrollParent = screen.getByTestId('scroll-parent');
        const advancedSection = document.getElementById('advanced-customization-steps');

        expect(advancedSection).not.toBeNull();

        Object.defineProperty(scrollParent, 'scrollHeight', {
            value: 640,
            configurable: true,
        });
        Object.defineProperty(scrollParent, 'clientHeight', {
            value: 220,
            configurable: true,
        });
        Object.defineProperty(scrollParent, 'scrollTop', {
            value: 40,
            writable: true,
            configurable: true,
        });

        scrollParent.getBoundingClientRect = vi.fn(() => ({
            top: 120,
            left: 0,
            bottom: 340,
            right: 320,
            width: 320,
            height: 220,
            x: 0,
            y: 120,
            toJSON: () => ({}),
        }));

        const firstAdvancedCard = advancedSection?.firstElementChild as HTMLElement | null;
        expect(firstAdvancedCard).not.toBeNull();

        firstAdvancedCard.getBoundingClientRect = vi.fn(() => ({
            top: 280,
            left: 0,
            bottom: 520,
            right: 320,
            width: 320,
            height: 240,
            x: 0,
            y: 280,
            toJSON: () => ({}),
        }));

        vi.clearAllMocks();

        fireEvent.click(screen.getByRole('button', { name: /Edit Design Details/i }));

        await waitFor(() => {
            expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({
                top: 184,
                behavior: 'smooth',
            });
        });
    });

    it('renders tiered flavor rows below height for 3-tier cakes', () => {
        const props = buildProps();
        props.cakeInfo = {
            ...props.cakeInfo,
            type: '3 Tier',
            size: '8" Round',
            flavors: ['Chocolate Cake', 'Ube Cake', 'Vanilla Cake'],
        };

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.getByText('Top Flavor')).toBeInTheDocument();
        expect(screen.getByText('Middle Flavor')).toBeInTheDocument();
        expect(screen.getByText('Bottom Flavor')).toBeInTheDocument();

        const middleFlavorRow = screen.getByText('Middle Flavor').parentElement;
        expect(middleFlavorRow).not.toBeNull();
        fireEvent.click(within(middleFlavorRow as HTMLElement).getByRole('button', { name: 'Vanilla' }));

        expect(props.onCakeInfoChange).toHaveBeenCalledWith({ flavors: ['Chocolate Cake', 'Vanilla Cake', 'Vanilla Cake'] });
    });

    it('hides icing type and height options for cupcakes', () => {
        const props = buildProps();
        props.cakeInfo = {
            type: 'Cupcake',
            size: '2oz - 12 pieces',
            thickness: '2 in',
            flavors: ['Chocolate Cake'],
        };

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.queryByText('Icing Type')).not.toBeInTheDocument();
        expect(screen.queryByText('Height')).not.toBeInTheDocument();
        expect(screen.queryByText('Height per Cake')).not.toBeInTheDocument();
    });
});
