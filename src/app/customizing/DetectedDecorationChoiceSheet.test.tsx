import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DetectedDecorationChoiceSheet } from './DetectedDecorationChoiceSheet';

describe('DetectedDecorationChoiceSheet', () => {
    it('lists every overlapping decoration and returns the selected item', () => {
        const onChoose = vi.fn();
        const onClose = vi.fn();
        const choices = [
            { id: 'topper-1', itemCategory: 'topper' as const, label: 'Sugar flower' },
            { id: 'element-1', itemCategory: 'element' as const, label: 'Blue ribbon' },
        ];

        render(
            <DetectedDecorationChoiceSheet
                choices={choices}
                bottomOffset={72}
                onChoose={onChoose}
                onClose={onClose}
            />
        );

        expect(screen.getByRole('dialog', { name: 'Choose a decoration' })).toBeInTheDocument();
        expect(screen.getByText('Main topper')).toBeInTheDocument();
        expect(screen.getByText('Support element')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Choose Blue ribbon, Support element' }));
        expect(onChoose).toHaveBeenCalledWith(choices[1]);

        fireEvent.click(screen.getByRole('button', { name: 'Close Choose a decoration' }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
