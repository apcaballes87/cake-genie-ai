import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    addCakeMessage: vi.fn(),
    removeCakeMessage: vi.fn(),
    updateCakeMessage: vi.fn(),
    additionalInstructions: '',
    onAdditionalInstructionsChange: vi.fn(),
    updateMainTopper: vi.fn(),
    updateSupportElement: vi.fn(),
    onTopperImageReplace: vi.fn(),
    onSupportElementImageReplace: vi.fn(),
    openTopperSheet: vi.fn(),
    onCakeInfoChange: vi.fn(),
    onIcingTypeChange: vi.fn(),
    onIcingDesignChange: vi.fn(),
    icingTypePriceDeltas: { soft_icing: null, fondant: 600 },
    addOnPricing: 0,
});

describe('CustomizingStepSummarySections', () => {
    it('renders Cake Type below Cake Message and Additional Instructions', () => {
        const props = buildProps();
        props.additionalInstructions = 'Keep the topper centered.';

        render(<CustomizingStepSummarySections {...props} />);

        const cakeMessage = screen.getByText('CAKE MESSAGE');
        const cakeType = screen.getByText('Cake Type');
        const instructions = screen.getByRole('textbox', { name: 'Additional Instructions' });
        expect(instructions).toHaveValue('Keep the topper centered.');
        fireEvent.change(instructions, { target: { value: 'Use a softer pink.' } });

        expect(props.onAdditionalInstructionsChange).toHaveBeenCalledWith('Use a softer pink.');
        expect(cakeMessage.compareDocumentPosition(cakeType) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(cakeType.compareDocumentPosition(instructions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Edit Design Details/i })).not.toBeInTheDocument();
    });

    it('keeps cake type controls visible and still forwards message actions', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /3 Tier/i }));
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Congrats!' } });
        fireEvent.click(screen.getByRole('button', { name: 'Delete Front message' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));

        expect(props.onCakeInfoChange).toHaveBeenCalledWith({ type: '3 Tier' });
        expect(props.updateCakeMessage).toHaveBeenCalledWith('message-1', {
            text: 'Congrats!',
        });
        expect(props.removeCakeMessage).toHaveBeenCalledWith('message-1');
        expect(screen.queryByText('Choose Cake Type')).not.toBeInTheDocument();
    });

    it('opens the icing popup and forwards icing-type changes', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /Soft Icing/i }));

        fireEvent.click(screen.getAllByText('Fondant')[0]);

        expect(props.onIcingTypeChange).toHaveBeenCalledWith('fondant');
    });

    it('shows the signed price change only on the unselected icing button', () => {
        const props = buildProps();

        const { rerender } = render(<CustomizingStepSummarySections {...props} />);

        const fondantButton = screen.getByRole('button', { name: /Fondant.*\+₱600/i });
        expect(within(fondantButton).getByText('+₱600')).toHaveClass('text-emerald-600');
        expect(screen.getByRole('button', { name: /^Soft Icing$/i })).not.toHaveTextContent('₱600');

        props.icingTypePriceDeltas = { soft_icing: null, fondant: -200 };
        rerender(<CustomizingStepSummarySections {...props} />);

        const discountedFondantButton = screen.getByRole('button', { name: /Fondant.*-₱200/i });
        expect(within(discountedFondantButton).getByText('-₱200')).toHaveClass('text-red-600');
    });

    it('shows the signed price change in the mobile layout', () => {
        const props = buildProps();
        props.layout = 'mobile';

        render(<CustomizingStepSummarySections {...props} />);

        const fondantButton = screen.getByRole('button', { name: /Fondant.*\+₱600/i });
        expect(within(fondantButton).getByText('+₱600')).toHaveClass('text-emerald-600');
    });

    it('does not mix icing thumbnails into the default cake options step', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.queryByRole('button', { name: /Top Border/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Top Icing/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Body Icing/i })).not.toBeInTheDocument();
    });

    it('renders the empty-message CTA without the hidden Edit Design Details group', () => {
        const props = buildProps();
        props.layout = 'mobile';
        props.cakeMessages = [];

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /\+ Add message/i }));
        expect(screen.getByRole('button', { name: /3 Tier/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Edit Design Details/i })).not.toBeInTheDocument();
        expect(screen.queryByText('Cake Toppers')).not.toBeInTheDocument();
    });

    it('does not render the hidden decoration group', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.queryByText('Cake Toppers')).not.toBeInTheDocument();
        expect(screen.queryByText(/No decorations detected yet/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Edit Design Details/i })).not.toBeInTheDocument();
    });

    it('keeps cake messages visible even when no toppers or support elements were detected', () => {
        const props = buildProps();
        props.mainToppers = [];
        props.supportElements = [];

        render(<CustomizingStepSummarySections {...props} />);

        expect(screen.getByText('CAKE MESSAGE')).toBeInTheDocument();
        expect(screen.queryByText('Cake Toppers')).not.toBeInTheDocument();
    });

    it('splits icing into its own step when requested', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} separateIcingStep />);

        expect(screen.getByRole('button', { name: /Top Border/i })).toBeInTheDocument();
    });

    it('renders cake-design quick actions at the top of Cake Options while keeping AI chat outside', () => {
        const props = buildProps();
        props.aiChatNode = <div data-testid="ai-chat-node">AI Cake Assistant</div>;
        props.cakeDesignQuickActionsNode = <div data-testid="cake-design-quick-actions">All Edible Toppers</div>;

        render(<CustomizingStepSummarySections {...props} />);

        // Open the floating color picker
        const softIcingBtn = screen.getByRole('button', { name: /Soft Icing/i });
        fireEvent.click(softIcingBtn);

        const icingTypeLabel = screen.getByText('Icing Type & Color');
        const mainLabel = screen.getByText('Main');
        const cakeMessage = screen.getByText('CAKE MESSAGE');
        const cakeType = screen.getByText('Cake Type');
        const aiChatTitle = screen.getByText('AI Cake Assistant');
        const aiChatNode = screen.getByTestId('ai-chat-node');
        const cakeDesignQuickActions = screen.getByTestId('cake-design-quick-actions');

        expect(cakeDesignQuickActions.compareDocumentPosition(icingTypeLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(icingTypeLabel.compareDocumentPosition(mainLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(aiChatTitle.compareDocumentPosition(icingTypeLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(aiChatNode.parentElement).toHaveClass('w-full', 'min-w-0');
        expect(aiChatNode.parentElement).not.toHaveClass('genie-card', 'p-2', 'rounded-2xl');
        expect(screen.getByTitle('red')).toBeInTheDocument();
        expect(cakeMessage.compareDocumentPosition(cakeType) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole('button', { name: /2 Tier/i })).toHaveClass('max-md:min-h-[34px]');
        expect(screen.getByRole('button', { name: /3 Tier/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Edit Design Details/i })).not.toBeInTheDocument();
        expect(document.getElementById('advanced-customization-steps')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Soft Icing$/i })).toHaveClass('max-md:min-h-[34px]');
        expect(screen.getByRole('button', { name: 'Chocolate' })).toHaveClass('max-md:min-h-[34px]');
    });

    it('does not offer a manual AI icing-color action', () => {
        const props = buildProps();

        render(<CustomizingStepSummarySections {...props} />);

        // Open the floating color picker
        const softIcingBtn = screen.getByRole('button', { name: /Soft Icing/i });
        fireEvent.click(softIcingBtn);

        expect(screen.queryByRole('button', { name: /Fix Icing Color/i })).not.toBeInTheDocument();
    });

    it('forwards a swatch selection with the exact next icing design for image application', () => {
        const props = buildProps();
        props.onIcingColorSelect = vi.fn();

        render(<CustomizingStepSummarySections {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /Soft Icing/i }));
        fireEvent.click(screen.getByTitle('red'));

        expect(props.onIcingColorSelect).toHaveBeenCalledWith(expect.objectContaining({
            colors: expect.objectContaining({
                top: '#EF4444',
                side: '#EF4444',
            }),
        }), { name: 'red', hex: '#EF4444' });
        expect(props.onIcingDesignChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: /Fix Icing Color|Apply Design Changes/i })).not.toBeInTheDocument();
    });

    it('hides the fix icing color button and shows a wait notice during background edits', () => {
        const props = buildProps();
        props.isStudioBackgroundEditingPending = true;

        render(<CustomizingStepSummarySections {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /Soft Icing/i }));

        expect(screen.queryByRole('button', { name: /Fix Icing Color/i })).not.toBeInTheDocument();
        expect(screen.getByText("Please wait while we're editing the background.")).toBeInTheDocument();
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
        const middleVanilla = within(middleFlavorRow as HTMLElement).getByRole('button', { name: 'Vanilla' });
        expect(middleVanilla).toHaveClass('max-md:min-h-[34px]');
        fireEvent.click(middleVanilla);

        expect(props.onCakeInfoChange).toHaveBeenCalledWith({ flavors: ['Chocolate Cake', 'Vanilla Cake', 'Vanilla Cake'] });
    });

    it('allows Chocolate and Vanilla flavors for Bento cakes without auto-correcting Vanilla', () => {
        const props = buildProps();
        props.cakeInfo = {
            type: 'Bento',
            size: '4" Round',
            thickness: '2 in',
            flavors: ['Vanilla Cake'],
        };

        const { rerender } = render(<CustomizingStepSummarySections {...props} />);

        expect(screen.getByRole('button', { name: 'Chocolate' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Vanilla' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Ube' })).toBeDisabled();
        expect(props.onCakeInfoChange).not.toHaveBeenCalled();

        props.cakeInfo = { ...props.cakeInfo, flavors: ['Chocolate Cake'] };
        rerender(<CustomizingStepSummarySections {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'Vanilla' }));

        expect(props.onCakeInfoChange).toHaveBeenCalledWith({ flavors: ['Vanilla Cake'] });
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
