import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomizingSidebarPanel } from './CustomizingSidebarPanel';

vi.mock('./CustomizingAiChatPanel', () => ({
    CustomizingAiChatPanel: ({ className }: { className?: string }) => (
        <div data-testid="ai-chat-panel">{className}</div>
    ),
}));

vi.mock('./CustomizingStepSummarySections', () => ({
    CustomizingStepSummarySections: ({ layout }: { layout: string }) => (
        <div data-testid="step-summary-panel">summary-{layout}</div>
    ),
}));

vi.mock('../../components/LoadingSkeletons', () => ({
    ChosenOptionsSkeleton: () => <div>chosen-options-skeleton</div>,
}));

vi.mock('../../components/icons', () => ({
    MagicSparkleIcon: () => <div>magic-sparkle-icon</div>,
}));

const buildProps = (): React.ComponentProps<typeof CustomizingSidebarPanel> => ({
    showLoadingState: false,
    showContentState: true,
    showAiChat: true,
    aiChatProps: {
        containerRef: { current: null },
        inputRef: { current: null },
        chatInput: 'make it pink',
        selectedAiPromptTemplate: null,
        selectedAiPromptColor: '#ffffff',
        showAiPromptColorPicker: false,
        showAiPromptSuggestions: false,
        filteredAiChatPromptSuggestions: [],
        selectedAiPromptIndex: 0,
        isAiProcessing: false,
        isUpdatingDesign: false,
        onSubmit: vi.fn(),
        onTemplateColorPickerToggle: vi.fn(),
        onTemplateClear: vi.fn(),
        onTemplateColorChange: vi.fn(),
        onInputChange: vi.fn(),
        onInputInteract: vi.fn(),
        onInputKeyDown: vi.fn(),
        onSuggestionSelect: vi.fn(),
    },
    stepSummaryProps: {
        cakeInfo: null,
        icingDesign: null,
        cakeMessages: [],
        mainToppers: [],
        supportElements: [],
        markerMap: new Map(),
        itemPrices: new Map(),
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
    },
});

describe('CustomizingSidebarPanel', () => {
    it('renders the desktop loading state', () => {
        const props = buildProps();
        props.showLoadingState = true;
        props.showContentState = false;

        render(<CustomizingSidebarPanel {...props} />);

        expect(screen.getByText('Analyzing Design...')).toBeInTheDocument();
        expect(screen.getByText('chosen-options-skeleton')).toBeInTheDocument();
        expect(screen.queryByTestId('step-summary-panel')).not.toBeInTheDocument();
    });

    it('renders the desktop ai chat and step summary content', () => {
        const props = buildProps();

        render(<CustomizingSidebarPanel {...props} />);

        expect(screen.getByTestId('ai-chat-panel')).toBeInTheDocument();
        expect(screen.getByText(/hidden md:block/)).toBeInTheDocument();
        expect(screen.getByTestId('step-summary-panel')).toHaveTextContent('summary-desktop');
    });

    it('renders the empty upload prompt when no sidebar content is available', () => {
        const props = buildProps();
        props.showContentState = false;
        props.showAiChat = false;

        render(<CustomizingSidebarPanel {...props} />);

        expect(screen.getByText('Upload an image to get started.')).toBeInTheDocument();
        expect(screen.queryByTestId('ai-chat-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('step-summary-panel')).not.toBeInTheDocument();
    });
});