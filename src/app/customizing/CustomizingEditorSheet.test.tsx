import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomizingEditorSheet } from './CustomizingEditorSheet';

vi.mock('../../components/CustomizationBottomSheet', () => ({
    CustomizationBottomSheet: ({ title, onClose, actionButton, children, style }: {
        title: string;
        onClose: () => void;
        actionButton?: React.ReactNode;
        children: React.ReactNode;
        style?: React.CSSProperties;
    }) => (
        <div>
            <span>{title}</span>
            <span>{style?.bottom}</span>
            <button onClick={onClose}>close-sheet</button>
            <div>{actionButton}</div>
            <div>{children}</div>
        </div>
    ),
}));

const buildProps = (): React.ComponentProps<typeof CustomizingEditorSheet> => ({
    isOpen: true,
    activeCustomization: 'options',
    activeTopperSection: null,
    showAvailabilityOffset: true,
    showWarningOffset: false,
    hasCakeInfoChanges: true,
    hasPendingVisualChanges: false,
    isUpdatingDesign: false,
    hasOriginalImageData: true,
    isEmpty: false,
    onClose: vi.fn(),
    onApplyOptions: vi.fn(),
    onApplyPendingDesignChanges: vi.fn(),
    children: <div>panel-content</div>,
});

describe('CustomizingEditorSheet', () => {
    it('renders the options title and apply-changes action', () => {
        const props = buildProps();

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('Cake Options')).toBeInTheDocument();
        expect(screen.getByText('168px')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /apply changes/i }));
        expect(props.onApplyOptions).toHaveBeenCalledTimes(1);
        expect(screen.getByText('panel-content')).toBeInTheDocument();
    });

    it('keeps the options apply action visible but disabled when nothing changed', () => {
        const props = buildProps();
        props.hasCakeInfoChanges = false;

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByRole('button', { name: /apply changes/i })).toBeDisabled();
    });

    it('renders the visual apply action and disables it without image data', () => {
        const props = buildProps();
        props.activeCustomization = 'icing';
        props.hasCakeInfoChanges = false;
        props.hasPendingVisualChanges = true;
        props.hasOriginalImageData = false;

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('Icing Colors')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /apply all changes/i })).toBeDisabled();
    });

    it('keeps the visual apply action visible but disabled with no pending changes', () => {
        const props = buildProps();
        props.activeCustomization = 'messages';
        props.hasCakeInfoChanges = false;
        props.hasPendingVisualChanges = false;

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByRole('button', { name: /apply all changes/i })).toBeDisabled();
    });

    it('uses topper-specific titles and forwards close interactions', () => {
        const props = buildProps();
        props.activeCustomization = 'toppers';
        props.activeTopperSection = 'support';

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('Support Elements')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'close-sheet' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('offsets the sheet above both warning and availability bars when both are visible', () => {
        const props = buildProps();
        props.showWarningOffset = true;

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('206px')).toBeInTheDocument();
    });
});
