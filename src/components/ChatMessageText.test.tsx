import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessageText, splitChatMessageText } from './ChatMessageText';

describe('ChatMessageText', () => {
    it('renders http and https URLs as safe external links without trailing punctuation', () => {
        render(<ChatMessageText text="View your cake: https://genie.ph/customizing/my-cake." />);

        const link = screen.getByRole('link', { name: 'https://genie.ph/customizing/my-cake' });
        expect(link).toHaveAttribute('href', 'https://genie.ph/customizing/my-cake');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('preserves ordinary text and does not turn unsafe schemes into links', () => {
        render(<ChatMessageText text="javascript:alert(1) and https://genie.ph/help" />);

        expect(screen.getByText('javascript:alert(1) and')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'https://genie.ph/help' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).not.toBeInTheDocument();
    });

    it('keeps balanced parentheses inside a URL while trimming sentence punctuation', () => {
        expect(splitChatMessageText('Read https://genie.ph/cakes/(birthday).')).toEqual([
            { text: 'Read ' },
            { text: 'https://genie.ph/cakes/(birthday)', href: 'https://genie.ph/cakes/(birthday)' },
            { text: '.' },
        ]);
    });
});
