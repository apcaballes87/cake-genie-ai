type AiChatPromptSlotType = 'color';

export type ParsedAiChatPromptTemplate = {
    template: string;
    prefix: string;
    suffix: string;
    slotType: AiChatPromptSlotType;
    placeholderLabel: string;
};

const inferColorPlaceholderLabel = (normalizedSuggestion: string): string | null => {
    if (normalizedSuggestion.includes('message color')) return 'message color';
    if (normalizedSuggestion.includes('covered base board color') || normalizedSuggestion.includes('gumpaste covered base board')) return 'base board color';
    if (normalizedSuggestion.includes('top border')) return 'top border color';
    if (normalizedSuggestion.includes('bottom border')) return 'bottom border color';
    if (normalizedSuggestion.includes('drip')) return 'drip color';
    if (normalizedSuggestion.includes('top icing')) return 'top icing color';
    if (normalizedSuggestion.includes('side icing')) return 'side icing color';
    if (normalizedSuggestion.includes('icing')) return 'icing color';
    if (normalizedSuggestion.includes('color of the')) return 'decor color';
    return null;
};

export const parseAiChatPromptTemplate = (suggestion: string): ParsedAiChatPromptTemplate | null => {
    if (!suggestion.includes('...')) return null;
    if (suggestion.split('...').length !== 2) return null;

    const normalizedSuggestion = suggestion.trim().toLowerCase();

    if (normalizedSuggestion.includes('colors of the')) return null;

    const placeholderLabel = inferColorPlaceholderLabel(normalizedSuggestion);
    if (!placeholderLabel) return null;

    const [prefix, suffix] = suggestion.split('...');

    return {
        template: suggestion,
        prefix,
        suffix,
        slotType: 'color',
        placeholderLabel,
    };
};

export const fillAiChatPromptTemplate = (
    template: ParsedAiChatPromptTemplate,
    slotValue: string
): string => `${template.prefix}${slotValue}${template.suffix}`.trim();