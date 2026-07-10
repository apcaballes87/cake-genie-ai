import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeMessageUI } from '@/types';
import { CustomizingMessagesPanel } from './CustomizingMessagesPanel';

const topMessage: CakeMessageUI = {
    id: 'message-top',
    type: 'gumpaste_letters',
    position: 'top',
    text: 'Happy Birthday',
    color: '#000000',
    isEnabled: true,
    price: 0,
    x: 0,
    y: 0,
};

const buildProps = () => ({
    isVisible: true,
    cakeMessages: [topMessage],
    cakeType: '2 Tier' as const,
    addCakeMessage: vi.fn(),
    updateCakeMessage: vi.fn(),
    removeCakeMessage: vi.fn(),
});

describe('CustomizingMessagesPanel', () => {
    it('renders the message row inline with direct text and position controls', () => {
        render(<CustomizingMessagesPanel {...buildProps()} />);

        expect(screen.getByLabelText('Text')).toHaveValue('Happy Birthday');
        expect(screen.getByLabelText('Position for message-top')).toHaveValue('top');
    });

    it('forwards direct text and color edits', () => {
        const props = buildProps();
        render(<CustomizingMessagesPanel {...props} />);

        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Congrats!' } });
        fireEvent.click(screen.getByRole('button', { name: 'Choose color for message-top' }));
        fireEvent.click(screen.getByRole('button', { name: 'Select Red color' }));

        expect(props.updateCakeMessage).toHaveBeenCalledWith(topMessage.id, {
            text: 'Congrats!',
            isPlaceholder: false,
        });
        expect(props.updateCakeMessage).toHaveBeenCalledWith(topMessage.id, { color: '#FF0000' });
    });

    it('adds a new message row at the first unused position', () => {
        const props = buildProps();
        props.cakeMessages = [];

        render(<CustomizingMessagesPanel {...props} />);
        fireEvent.click(screen.getByRole('button', { name: '+ Add message' }));

        expect(props.addCakeMessage).toHaveBeenCalledWith('side');
    });
});
