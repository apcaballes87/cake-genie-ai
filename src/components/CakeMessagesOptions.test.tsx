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

        expect(screen.getByText('Cake Top')).toBeInTheDocument();
        expect(screen.getByText('Cake Front')).toBeInTheDocument();
        expect(screen.getByText('Cake Base')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add message (Cake Top)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add message (Cake Front)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add message (Cake Base)' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('hides existing positions and adds the chosen missing position', async () => {
        const user = userEvent.setup();
        const addCakeMessage = vi.fn();

        renderCakeMessagesOptions([createMessage({ position: 'top' })], { addCakeMessage });

        expect(screen.queryByRole('button', { name: 'Add message (Cake Top)' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Add message (Cake Front)' }));
        expect(addCakeMessage).toHaveBeenCalledWith('side');
    });

    it('renders the existing message directly in its single position container', () => {
        renderCakeMessagesOptions([createMessage({ position: 'side', text: 'Hello' })], {
            selectedMessageId: 'message-1',
        });

        expect(screen.getByText('Cake Front')).toBeInTheDocument();
        expect(screen.queryByText('Customize Message')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete Cake Front message' })).toBeInTheDocument();
    });

    it('keeps cake base hidden for bento cakes', () => {
        renderCakeMessagesOptions([], { cakeType: 'Bento' as CakeType });

        expect(screen.getByText('Cake Top')).toBeInTheDocument();
        expect(screen.getByText('Cake Front')).toBeInTheDocument();
        expect(screen.queryByText('Cake Base')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add message (Cake Base)' })).not.toBeInTheDocument();
    });
});