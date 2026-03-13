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
    inputRef: React.createRef<HTMLInputElement>(),
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
    onSubmit: vi.fn(),
    onTemplateColorPickerToggle: vi.fn(),
    onTemplateClear: vi.fn(),
    onTemplateColorChange: vi.fn(),
    onInputChange: vi.fn(),
    onInputInteract: vi.fn(),
    onInputKeyDown: vi.fn(),
    onSuggestionSelect: vi.fn(),
});

describe('CustomizingAiChatPanel', () => {
    it('renders free-text mode and forwards primary interactions', () => {
        const props = buildProps();

        render(<CustomizingAiChatPanel {...props} />);

        const input = screen.getByPlaceholderText('✨ Describe changes here...');
        fireEvent.focus(input);
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: 'make it pastel blue' } });
        fireEvent.click(screen.getByRole('button', { name: /add butterflies/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit AI Edit' }));

        expect(props.onInputInteract).toHaveBeenCalledTimes(2);
        expect(props.onInputChange).toHaveBeenCalledWith('make it pastel blue');
        expect(props.onSuggestionSelect).toHaveBeenCalledWith('add butterflies');
        expect(props.onSubmit).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Customize your cake design by doing steps 1 to 4 below')).toBeInTheDocument();
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
        expect(screen.queryByPlaceholderText('✨ Describe changes here...')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit AI Edit' })).toBeDisabled();
        expect(props.onTemplateColorPickerToggle).toHaveBeenCalledTimes(1);
        expect(props.onTemplateClear).toHaveBeenCalledTimes(1);
        expect(props.onTemplateColorChange).toHaveBeenCalledTimes(1);
    });
});