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
    showPrintoutOffset: false,
    onClose: vi.fn(),
    children: <div>panel-content</div>,
});

describe('CustomizingEditorSheet', () => {
    it('renders the options title without a manual apply action', () => {
        const props = buildProps();

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('Cake Options')).toBeInTheDocument();
        expect(screen.getByText('100px')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /apply changes/i })).not.toBeInTheDocument();
        expect(screen.getByText('panel-content')).toBeInTheDocument();
    });

    it('does not render a visual apply action', () => {
        const props = buildProps();
        props.activeCustomization = 'icing';

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('Icing Colors')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /apply all changes/i })).not.toBeInTheDocument();
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

    it('offsets the sheet above availability bar when visible', () => {
        const props = buildProps();
        props.showAvailabilityOffset = true;

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('100px')).toBeInTheDocument();
    });

    it('offsets the sheet using base offset when availability bar is hidden', () => {
        const props = buildProps();
        props.showAvailabilityOffset = false;

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('72px')).toBeInTheDocument();
    });

    it('adds the full printout notification row to the sheet offset', () => {
        const props = buildProps();
        props.showAvailabilityOffset = true;
        props.showPrintoutOffset = true;

        render(<CustomizingEditorSheet {...props} />);

        expect(screen.getByText('132px')).toBeInTheDocument();
    });
});
