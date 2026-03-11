import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { COLORS } from '@/constants';
import type { CakeMessageUI } from '@/types';
import { CustomizingMessagesPanel } from './CustomizingMessagesPanel';

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

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

const buildProps = (): React.ComponentProps<typeof CustomizingMessagesPanel> => ({
    isVisible: true,
    hasMessageChanges: true,
    cakeMessages: [topMessage],
    markerMap: new Map(),
    selectedMessageId: undefined,
    cakeType: '2 Tier',
    onItemClick: vi.fn(),
    addCakeMessage: vi.fn(),
    updateCakeMessage: vi.fn(),
    removeCakeMessage: vi.fn(),
    onRevert: vi.fn(),
});

describe('CustomizingMessagesPanel', () => {
    it('forwards revert and existing-message selection interactions', () => {
        const props = buildProps();

        render(<CustomizingMessagesPanel {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
        fireEvent.click(screen.getByRole('button', { name: 'Top Top' }));

        expect(props.onRevert).toHaveBeenCalledTimes(1);
        expect(props.onItemClick).toHaveBeenCalledWith(expect.objectContaining({
            id: 'message-top',
            itemCategory: 'message',
        }));
    });

    it('renders the selected message editor and forwards edits', () => {
        const props = buildProps();
        props.selectedMessageId = topMessage.id;

        render(<CustomizingMessagesPanel {...props} />);

        fireEvent.change(screen.getByLabelText('Message Content'), { target: { value: 'Congrats!' } });
        fireEvent.click(screen.getAllByRole('button', { name: /Select .* color/i })[0]);

        expect(props.updateCakeMessage).toHaveBeenCalledWith(topMessage.id, expect.objectContaining({
            text: 'Congrats!',
            isPlaceholder: false,
        }));
        expect(props.updateCakeMessage).toHaveBeenCalledWith(topMessage.id, { color: COLORS[0].hex });
    });

    it('adds a new message for an empty position', () => {
        const props = buildProps();
        props.cakeMessages = [];

        render(<CustomizingMessagesPanel {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Top Top' }));

        expect(props.addCakeMessage).toHaveBeenCalledWith('top');
    });
});