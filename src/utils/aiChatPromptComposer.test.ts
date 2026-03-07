import { describe, expect, it } from 'vitest';

import { fillAiChatPromptTemplate, parseAiChatPromptTemplate } from './aiChatPromptComposer';

describe('aiChatPromptComposer', () => {
    it('parses icing color templates', () => {
        expect(parseAiChatPromptTemplate('change the pink icing to ...')).toEqual({
            template: 'change the pink icing to ...',
            prefix: 'change the pink icing to ',
            suffix: '',
            slotType: 'color',
            placeholderLabel: 'icing color',
        });
    });

    it('parses message color templates', () => {
        expect(parseAiChatPromptTemplate('change the "Happy Birthday" message color to ...')?.placeholderLabel).toBe('message color');
    });

    it('parses add-color templates for drip, borders, and base boards', () => {
        expect(parseAiChatPromptTemplate('add a ... drip on the cake')?.placeholderLabel).toBe('drip color');
        expect(parseAiChatPromptTemplate('add a ... top border')?.placeholderLabel).toBe('top border color');
        expect(parseAiChatPromptTemplate('add a ... gumpaste covered base board')?.placeholderLabel).toBe('base board color');
    });

    it('ignores non-color and multi-color suggestions', () => {
        expect(parseAiChatPromptTemplate('change the top message to ...')).toBeNull();
        expect(parseAiChatPromptTemplate('change the colors of the floral topper to ...')).toBeNull();
    });

    it('fills the selected color into the template', () => {
        const template = parseAiChatPromptTemplate('change the pink drip to ...');
        expect(template).not.toBeNull();
        expect(fillAiChatPromptTemplate(template!, 'Dark Blue')).toBe('change the pink drip to Dark Blue');
    });

    it('fills add-color templates with the chosen color', () => {
        const template = parseAiChatPromptTemplate('add a ... top border');
        expect(template).not.toBeNull();
        expect(fillAiChatPromptTemplate(template!, 'Light Blue')).toBe('add a Light Blue top border');
    });
});