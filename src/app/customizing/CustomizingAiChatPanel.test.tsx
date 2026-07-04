import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParsedAiChatPromptTemplate } from '@/utils/aiChatPromptComposer';
import { CustomizingAiChatPanel } from './CustomizingAiChatPanel';

const suggestionTemplate: ParsedAiChatPromptTemplate = {
    template: 'change the pink icing to ...',
    prefix: 'change the pink icing to ',
    suffix: '',
    slotType: 'color',
    placeholderLabel: 'icing color',
};

const buildProps = () => ({
    className: 'test-panel',
    containerRef: React.createRef<HTMLFormElement>(),
    inputRef: React.createRef<HTMLTextAreaElement>(),
    chatInput: 'make it blue',
    selectedAiPromptTemplate: null as ParsedAiChatPromptTemplate | null,
    selectedAiPromptColor: '',
    showAiPromptColorPicker: false,
    showAiPromptSuggestions: true,
    filteredAiChatPromptSuggestions: [
        { suggestion: 'add butterflies', template: null },
        { suggestion: suggestionTemplate.template, template: suggestionTemplate },
    ],
    selectedAiPromptIndex: 0,
    isAiProcessing: false,
    isUpdatingDesign: false,
    attachedImageName: null as string | null,
    isAttachmentUploading: false,
    onSubmit: vi.fn(),
    onAttachmentSelect: vi.fn(),
    onAttachmentClear: vi.fn(),
    onTemplateColorPickerToggle: vi.fn(),
    onTemplateClear: vi.fn(),
    onTemplateColorChange: vi.fn(),
    onInputChange: vi.fn(),
    onInputInteract: vi.fn(),
    onInputKeyDown: vi.fn(),
    onSuggestionSelect: vi.fn(),
});

describe('CustomizingAiChatPanel', () => {
    it('renders free-text mode and forwards primary interactions without submitting on Enter', () => {
        const props = buildProps();

        render(<CustomizingAiChatPanel {...props} />);

        const input = screen.getByPlaceholderText('✨ Tell Genie your cake design wish...');
        const uploadButton = screen.getByRole('button', { name: 'Attach reference image' });
        const submitButton = screen.getByRole('button', { name: 'Submit AI Edit' });
        const inputWrapper = input.parentElement;
        expect(input.tagName).toBe('TEXTAREA');
        expect(uploadButton.className).toContain('h-12');
        expect(uploadButton.className).toContain('w-12');
        expect(submitButton.className).toContain('h-10');
        expect(submitButton.className).toContain('w-10');
        expect(input).toHaveClass('block');
        expect(input.className).toContain('min-h-[46px]');
        expect(input.className).toContain('text-[12px]');
        expect(input).toHaveClass('pr-14');
        expect(inputWrapper?.className).toContain('rounded-2xl');
        expect(inputWrapper?.className).toContain('border');
        expect(inputWrapper?.className).toContain('min-h-12');
        fireEvent.focus(input);
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: 'make it pastel blue' } });
        fireEvent.click(screen.getByRole('button', { name: /add butterflies/i }));
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(props.onInputInteract).toHaveBeenCalledTimes(2);
        expect(props.onInputChange).toHaveBeenCalledWith('make it pastel blue');
        expect(props.onSuggestionSelect).toHaveBeenCalledWith('add butterflies');
        expect(props.onSubmit).not.toHaveBeenCalled();
    });

    it('shows autocomplete above the composer by default', () => {
        const props = buildProps();

        render(<CustomizingAiChatPanel {...props} />);

        const suggestionPanel = screen.getByRole('button', { name: /add butterflies/i }).closest('.absolute');
        const suggestionButton = screen.getByRole('button', { name: /add butterflies/i });
        expect(suggestionPanel?.className).toContain('bottom-full');
        expect(suggestionPanel?.className).toContain('mb-2');
        expect(suggestionButton.className).toContain('px-3');
        expect(suggestionButton.className).toContain('py-2');
        expect(suggestionButton.className).toContain('text-[12px]');
        expect(suggestionButton.className).toContain('leading-4');
    });

    it('can show autocomplete below the composer for desktop layouts', () => {
        const props = buildProps();

        render(<CustomizingAiChatPanel {...props} suggestionsPlacement="below" />);

        const suggestionPanel = screen.getByRole('button', { name: /add butterflies/i }).closest('.absolute');
        expect(suggestionPanel?.className).toContain('top-full');
        expect(suggestionPanel?.className).toContain('mt-2');
        expect(suggestionPanel?.className).not.toContain('bottom-full');
    });

    it('still submits through the send button', () => {
        const props = buildProps();

        const { container } = render(<CustomizingAiChatPanel {...props} />);

        fireEvent.submit(container.querySelector('form') as HTMLFormElement);

        expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });

    it('supports attaching and removing a reference image', () => {
        const props = buildProps();
        props.attachedImageName = 'sample-inspo.png';

        const { container, rerender } = render(<CustomizingAiChatPanel {...props} />);

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['image'], 'reference.png', { type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(props.onAttachmentSelect).toHaveBeenCalledTimes(1);
        expect(props.onAttachmentSelect).toHaveBeenCalledWith(file);
        expect(screen.getByText('sample-inspo.png')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Remove attached image' }));

        expect(props.onAttachmentClear).toHaveBeenCalledTimes(1);

        props.isAttachmentUploading = true;
        rerender(<CustomizingAiChatPanel {...props} />);
        expect(screen.getByRole('button', { name: 'Attach reference image' })).toBeDisabled();
    });

    it('renders template mode with color picker actions', () => {
        const props = buildProps();
        props.chatInput = '';
        props.selectedAiPromptTemplate = suggestionTemplate;
        props.showAiPromptColorPicker = true;
        props.selectedAiPromptColor = '#ffffff';

        render(<CustomizingAiChatPanel {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'icing color' }));
        fireEvent.click(screen.getByRole('button', { name: 'Edit prompt as text' }));
        fireEvent.click(screen.getAllByRole('button', { name: /Select .* color/i })[0]);

        expect(screen.getByText('Choose icing color')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('✨ Tell Genie your cake design wish...')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit AI Edit' })).toBeDisabled();
        expect(props.onTemplateColorPickerToggle).toHaveBeenCalledTimes(1);
        expect(props.onTemplateClear).toHaveBeenCalledTimes(1);
        expect(props.onTemplateColorChange).toHaveBeenCalledTimes(1);
    });
});
