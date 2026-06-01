import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { COLORS } from '@/constants';
import type { ClusteredMarker, IcingDesignUI, MainTopperUI } from '@/types';
import { CustomizingIcingEditorPanel } from './CustomizingIcingEditorPanel';

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

const baseIcingDesign: IcingDesignUI = {
    base: 'soft_icing',
    color_type: 'single',
    drip: false,
    border_top: true,
    border_base: false,
    colors: {
        top: '#ffffff',
        side: '#f5deb3',
        borderTop: '#ff69b4',
    },
    gumpasteBaseBoard: false,
    dripPrice: 0,
    gumpasteBaseBoardPrice: 0,
};

const buildProps = (): React.ComponentProps<typeof CustomizingIcingEditorPanel> => ({
    isVisible: true,
    hasIcingChanges: true,
    icingDesign: baseIcingDesign,
    cakeType: '2 Tier',
    selectedItem: null,
    mainToppers: [] as MainTopperUI[],
    onSelectItem: vi.fn(),
    onIcingDesignChange: vi.fn(),
    onRevert: vi.fn(),
});

describe('CustomizingIcingEditorPanel', () => {
    it('forwards toolbar selection and revert interactions', () => {
        const props = buildProps();

        render(<CustomizingIcingEditorPanel {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Drip' }));
        fireEvent.click(screen.getByRole('button', { name: 'Revert' }));

        expect(props.onSelectItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'icing-edit-drip',
            itemCategory: 'icing',
            cakeType: '2 Tier',
        }));
        expect(props.onRevert).toHaveBeenCalledTimes(1);
    });

    it('updates combined body icing colors through the extracted editor', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-icing',
            itemCategory: 'icing',
            description: 'Body Icing',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;

        render(<CustomizingIcingEditorPanel {...props} />);

        fireEvent.click(screen.getAllByRole('button', { name: /Select .* color/i })[0]);

        expect(props.onIcingDesignChange).toHaveBeenCalledWith(expect.objectContaining({
            colors: expect.objectContaining({
                top: COLORS[0].hex,
                side: COLORS[0].hex,
            }),
        }));
    });

    it('hides top icing when an edible photo topper occupies the top', () => {
        const props = buildProps();
        props.mainToppers = [
            {
                id: 'photo-topper',
                type: 'edible_photo_top',
                original_type: 'edible_photo_top',
                description: 'Photo topper',
                size: 'medium',
                quantity: 1,
                group_id: 'group-1',
                classification: 'hero',
                isEnabled: true,
                price: 0,
            },
        ] satisfies MainTopperUI[];

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.queryByRole('button', { name: 'Top Icing' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Body Icing' })).toBeInTheDocument();
    });

    it('shows a pulsing text status below the body icing color palette while the AI mask is generating', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-icing',
            itemCategory: 'icing',
            description: 'Body Icing',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;
        props.isGeneratingMask = true;

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.getByText('Icing mask generation in progress...')).toBeInTheDocument();
    });

    it('shows a pulsing background edit status below the body icing color palette while background editing is pending', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-icing',
            itemCategory: 'icing',
            description: 'Body Icing',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;
        props.isStudioBackgroundEditingPending = true;

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.getByText('AI background editing in progress...')).toBeInTheDocument();
    });
});