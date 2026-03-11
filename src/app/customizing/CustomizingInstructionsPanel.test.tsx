import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomizingInstructionsPanel } from './CustomizingInstructionsPanel';

const buildProps = (): React.ComponentProps<typeof CustomizingInstructionsPanel> => ({
    isVisible: true,
    additionalInstructions: 'Match the reference colors exactly.',
    onAdditionalInstructionsChange: vi.fn(),
});

describe('CustomizingInstructionsPanel', () => {
    it('renders the current instructions and forwards textarea changes', () => {
        const props = buildProps();

        render(<CustomizingInstructionsPanel {...props} />);

        const textarea = screen.getByPlaceholderText(/please make the colors exactly as in the photo/i);

        expect(textarea).toHaveValue('Match the reference colors exactly.');

        fireEvent.change(textarea, { target: { value: 'Make the topper slightly taller.' } });

        expect(props.onAdditionalInstructionsChange).toHaveBeenCalledWith('Make the topper slightly taller.');
    });

    it('keeps the wrapper hidden when the panel is inactive', () => {
        const props = buildProps();
        props.isVisible = false;

        const { container } = render(<CustomizingInstructionsPanel {...props} />);

        expect(container.firstChild).toHaveClass('hidden');
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
});