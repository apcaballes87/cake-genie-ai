import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CakeMessagesOptions } from './CakeMessagesOptions';
import type { CakeMessageUI, CakeType } from '@/types';

vi.mock('./LazyImage', () => ({
    default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

const createMessage = (overrides: Partial<CakeMessageUI> = {}): CakeMessageUI => ({
    id: 'message-1',
    type: 'icing_script',
    text: 'Happy Birthday',
    position: 'top',
    color: '#000000',
    isEnabled: true,
    price: 0,
    ...overrides,
});

const baseProps = {
    markerMap: new Map<string, string>(),
    onItemClick: vi.fn(),
    addCakeMessage: vi.fn(),
    updateCakeMessage: vi.fn(),
    removeCakeMessage: vi.fn(),
};

const renderCakeMessagesOptions = (
    cakeMessages: CakeMessageUI[] = [],
    overrides: Partial<ComponentProps<typeof CakeMessagesOptions>> = {}
) => {
    render(
        <CakeMessagesOptions
            cakeMessages={cakeMessages}
            {...baseProps}
            {...overrides}
        />
    );
};

describe('CakeMessagesOptions', () => {
    it('renders one simplified container for top, front, and base when empty', () => {
        renderCakeMessagesOptions();

        // New design: a single row of 3 position-thumbnail buttons, each with
        // a short label ("Top" / "Front" / "Base"). No separate "Add message"
        // button — clicking the thumbnail itself adds the message.
        expect(screen.getByText('Top')).toBeInTheDocument();
        expect(screen.getByText('Front')).toBeInTheDocument();
        expect(screen.getByText('Base')).toBeInTheDocument();
        // No editor rendered when nothing is selected.
        expect(screen.queryByRole('button', { name: /Edit .* Message/i })).not.toBeInTheDocument();
    });

    it('adds a new message at the chosen position via the thumbnail button', async () => {
        const user = userEvent.setup();
        const addCakeMessage = vi.fn();

        renderCakeMessagesOptions([], { addCakeMessage });

        // The 3 thumbnail buttons are always rendered (the old "hide existing
        // position" UX was removed in the May 30 redesign).
        await user.click(screen.getByRole('button', { name: /Front/ }));
        expect(addCakeMessage).toHaveBeenCalledWith('side');
    });

    it('renders the existing message directly in its single position container', () => {
        renderCakeMessagesOptions([createMessage({ position: 'side', text: 'Hello' })], {
            selectedMessageId: 'message-1',
        });

        // Editor title uses the short label, not the legacy "Cake Front" string.
        expect(screen.getByText(/Edit Front Message/i)).toBeInTheDocument();
        expect(screen.queryByText('Customize Message')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete Front message' })).toBeInTheDocument();
    });

    it('keeps cake base hidden for bento cakes', () => {
        renderCakeMessagesOptions([], { cakeType: 'Bento' as CakeType });

        // Bento: 2 positions only (top, front). "Base" is filtered out.
        expect(screen.getByText('Top')).toBeInTheDocument();
        expect(screen.getByText('Front')).toBeInTheDocument();
        expect(screen.queryByText('Base')).not.toBeInTheDocument();
    });
});