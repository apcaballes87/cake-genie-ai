import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MainTopperUI, SupportElementUI } from '@/types';
import { CustomizingPhotosPanel } from './CustomizingPhotosPanel';

vi.mock('@/components/TopperCard', () => ({
    TopperCard: ({
        item,
        type,
        updateItem,
        onImageReplace,
    }: {
        item: { id: string };
        type: 'topper' | 'element';
        updateItem: (updates: { description: string }) => void;
        onImageReplace: (file: File) => void;
    }) => (
        <div>
            <span>{type}:{item.id}</span>
            <button onClick={() => updateItem({ description: `Updated ${item.id}` })}>Update {item.id}</button>
            <button onClick={() => onImageReplace(new File(['photo'], `${item.id}.png`, { type: 'image/png' }))}>Replace {item.id}</button>
        </div>
    ),
}));

const photoTopper: MainTopperUI = {
    id: 'top-photo',
    type: 'edible_photo_top',
    original_type: 'edible_photo_top',
    description: 'Top photo topper',
    size: 'medium',
    quantity: 1,
    group_id: 'group-1',
    classification: 'hero',
    isEnabled: true,
    price: 0,
};

const photoSupport: SupportElementUI = {
    id: 'side-photo',
    type: 'edible_photo_side',
    original_type: 'edible_photo_side',
    description: 'Side photo wrap',
    size: 'medium',
    quantity: 1,
    group_id: 'group-2',
    classification: 'accent',
    isEnabled: true,
    price: 0,
};

const buildProps = (): React.ComponentProps<typeof CustomizingPhotosPanel> => ({
    isVisible: true,
    mainToppers: [photoTopper],
    supportElements: [photoSupport],
    markerMap: new Map(),
    updateMainTopper: vi.fn(),
    updateSupportElement: vi.fn(),
    onTopperImageReplace: vi.fn(),
    onSupportElementImageReplace: vi.fn(),
    itemPrices: new Map(),
    isAdmin: false,
});

describe('CustomizingPhotosPanel', () => {
    it('renders the empty state when no edible photos are available', () => {
        const props = buildProps();
        props.mainToppers = [];
        props.supportElements = [];

        render(<CustomizingPhotosPanel {...props} />);

        expect(screen.getByText('No edible photos detected on this cake.')).toBeInTheDocument();
        expect(screen.getByText(/only available if the AI detected them/i)).toBeInTheDocument();
    });

    it('renders edible photo cards and forwards update and replace handlers', () => {
        const props = buildProps();

        render(<CustomizingPhotosPanel {...props} />);

        expect(screen.getByText('Top Photo')).toBeInTheDocument();
        expect(screen.getByText('Side Photo')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Update top-photo' }));
        fireEvent.click(screen.getByRole('button', { name: 'Update side-photo' }));
        fireEvent.click(screen.getByRole('button', { name: 'Replace top-photo' }));
        fireEvent.click(screen.getByRole('button', { name: 'Replace side-photo' }));

        expect(props.updateMainTopper).toHaveBeenCalledWith('top-photo', { description: 'Updated top-photo' });
        expect(props.updateSupportElement).toHaveBeenCalledWith('side-photo', { description: 'Updated side-photo' });
        expect(props.onTopperImageReplace).toHaveBeenCalledWith('top-photo', expect.any(File));
        expect(props.onSupportElementImageReplace).toHaveBeenCalledWith('side-photo', expect.any(File));
    });

    it('keeps the wrapper hidden when the panel is inactive', () => {
        const props = buildProps();
        props.isVisible = false;

        const { container } = render(<CustomizingPhotosPanel {...props} />);

        expect(container.firstChild).toHaveClass('hidden');
        expect(screen.getByText('Top Photo')).toBeInTheDocument();
    });
});