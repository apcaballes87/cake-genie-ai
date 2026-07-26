import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomizingSidebarPanel } from './CustomizingSidebarPanel';

vi.mock('./CustomizingStepSummarySections', () => ({
    CustomizingStepSummarySections: ({
        layout,
        hasToppersChanges,
        onApplyTopperChanges,
    }: {
        layout: string;
        hasToppersChanges?: boolean;
        onApplyTopperChanges?: () => void;
    }) => (
        <button
            type="button"
            data-testid="step-summary-panel"
            data-has-topper-changes={hasToppersChanges ? 'true' : 'false'}
            onClick={onApplyTopperChanges}
        >
            summary-{layout}
        </button>
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
    className: undefined,
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

    it('renders the desktop step summary content', () => {
        const props = buildProps();

        render(<CustomizingSidebarPanel {...props} />);

        expect(screen.queryByTestId('ai-chat-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('step-summary-panel')).toHaveTextContent('summary-desktop');
    });

    it('forwards the pending-topper Apply Design controls to the desktop summary', () => {
        const props = buildProps();
        const onApplyTopperChanges = vi.fn();
        props.stepSummaryProps.hasToppersChanges = true;
        props.stepSummaryProps.onApplyTopperChanges = onApplyTopperChanges;

        render(<CustomizingSidebarPanel {...props} />);

        const summary = screen.getByTestId('step-summary-panel');
        expect(summary).toHaveAttribute('data-has-topper-changes', 'true');
        summary.click();
        expect(onApplyTopperChanges).toHaveBeenCalledOnce();
    });

    it('accepts a custom container class for mobile loading usage', () => {
        const props = buildProps();
        props.showLoadingState = true;
        props.showContentState = false;
        props.className = 'mobile-loading-card';

        const { container } = render(<CustomizingSidebarPanel {...props} />);

        expect(container.firstChild).toHaveClass('mobile-loading-card');
        expect(screen.getByText('Analyzing Design...')).toBeInTheDocument();
    });

    it('renders the empty upload prompt when no sidebar content is available', () => {
        const props = buildProps();
        props.showContentState = false;

        render(<CustomizingSidebarPanel {...props} />);

        expect(screen.getByText('Upload an image to get started.')).toBeInTheDocument();
        expect(screen.queryByTestId('step-summary-panel')).not.toBeInTheDocument();
    });
});
