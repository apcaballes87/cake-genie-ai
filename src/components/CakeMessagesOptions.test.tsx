import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CakeMessagesOptions } from './CakeMessagesOptions';
import type { CakeMessageUI, CakeType } from '@/types';

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
    it('renders direct text, position, color, and delete controls for a message', () => {
        renderCakeMessagesOptions([createMessage({ position: 'side', text: 'Hello' })]);

        expect(screen.getByLabelText('Text')).toHaveValue('Hello');
        expect(screen.getByLabelText('Position for message-1')).toHaveValue('side');
        expect(screen.getByRole('button', { name: 'Delete Front message' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Choose color for message-1' })).toBeInTheDocument();
    });

    it('updates the message text directly', async () => {
        const user = userEvent.setup();
        const updateCakeMessage = vi.fn();
        renderCakeMessagesOptions([createMessage()], { updateCakeMessage });

        const input = screen.getByLabelText('Text');
        await user.clear(input);

        expect(updateCakeMessage).toHaveBeenLastCalledWith('message-1', {
            text: '',
        });
    });

    it('shows an existing message as a placeholder without replacing its value', () => {
        renderCakeMessagesOptions([createMessage({
            text: 'Happy Birthday',
            originalMessage: {
                type: 'icing_script',
                text: 'Happy Birthday',
                position: 'top',
                color: '#000000',
            },
        })]);

        expect(screen.getByLabelText('Text')).toHaveValue('');
        expect(screen.getByLabelText('Text')).toHaveAttribute('placeholder', 'Happy Birthday');
    });

    it('requires modal confirmation before removing a message', async () => {
        const user = userEvent.setup();
        const removeCakeMessage = vi.fn();
        renderCakeMessagesOptions([createMessage()], { removeCakeMessage });

        await user.click(screen.getByRole('button', { name: 'Delete Top message' }));
        expect(screen.getByRole('dialog', { name: 'Delete message?' })).toBeInTheDocument();
        expect(removeCakeMessage).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Delete message' }));
        expect(removeCakeMessage).toHaveBeenCalledWith('message-1');
    });

    it('updates the message position directly', async () => {
        const user = userEvent.setup();
        const updateCakeMessage = vi.fn();
        renderCakeMessagesOptions([createMessage()], { updateCakeMessage });

        await user.selectOptions(screen.getByLabelText('Position for message-1'), 'side');

        expect(updateCakeMessage).toHaveBeenCalledWith('message-1', { position: 'side' });
    });

    it('opens the floating color picker and updates the selected color', async () => {
        const user = userEvent.setup();
        const updateCakeMessage = vi.fn();
        renderCakeMessagesOptions([createMessage()], { updateCakeMessage });

        await user.click(screen.getByRole('button', { name: 'Choose color for message-1' }));

        expect(screen.getByText('Choose color')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Select Red color' }));
        expect(updateCakeMessage).toHaveBeenCalledWith('message-1', { color: '#FF0000' });
    });

    it('adds a blank row at an unused position and hides base for bento cakes', async () => {
        const user = userEvent.setup();
        const addCakeMessage = vi.fn();
        renderCakeMessagesOptions([createMessage({ position: 'top' })], {
            addCakeMessage,
            cakeType: 'Bento' as CakeType,
        });

        expect(screen.queryByRole('button', { name: /Add Base message/i })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Add message/i }));
        expect(addCakeMessage).toHaveBeenCalledWith('side');
    });
});
