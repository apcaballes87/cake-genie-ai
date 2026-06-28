import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { COLORS } from '@/constants';
import type { ClusteredMarker, IcingDesignUI, MainTopperUI } from '@/types';
import { CustomizingIcingEditorPanel } from './CustomizingIcingEditorPanel';

vi.mock('@/components/LazyImage', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

vi.mock('@/components/MagicGlitter', () => ({
    default: () => <div data-testid="magic-glitter" />,
}));

const baseIcingDesign: IcingDesignUI = {
    base: 'soft_icing',
    color_type: 'single',
    drip: false,
    border_top: true,
    border_base: false,
    colors: {
        side: '#f5deb3',
        top: '#ffffff',
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

    it('always shows Top Icing and Body Icing (Side) tools regardless of border/board features', () => {
        // M1: Top + Side tools are no longer gated on a feature flag.
        const props = buildProps();
        props.icingDesign = { ...baseIcingDesign, drip: false, border_top: false, border_base: false, gumpasteBaseBoard: false };

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.getByRole('button', { name: 'Top Icing' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Body Icing' })).toBeInTheDocument();
    });

    it('updates side icing color only (top icing is now its own group)', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-side',
            itemCategory: 'icing',
            description: 'side',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;

        render(<CustomizingIcingEditorPanel {...props} />);

        fireEvent.click(screen.getAllByRole('button', { name: /Select .* color/i })[0]);

        expect(props.onIcingDesignChange).toHaveBeenCalledWith(expect.objectContaining({
            colors: expect.objectContaining({
                side: COLORS[0].hex,
            }),
        }));
    });

    it('updates top icing color only (side icing is preserved)', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-top',
            itemCategory: 'icing',
            description: 'top',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;

        render(<CustomizingIcingEditorPanel {...props} />);

        fireEvent.click(screen.getAllByRole('button', { name: /Select .* color/i })[0]);

        expect(props.onIcingDesignChange).toHaveBeenCalledWith(expect.objectContaining({
            colors: expect.objectContaining({
                top: COLORS[0].hex,
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

    it('does not show a pulsing text status for icing edits since the mask is disabled', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-side',
            itemCategory: 'icing',
            description: 'side',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;
        props.isGeneratingMask = true;

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.queryByText('ai is editing your icing...')).not.toBeInTheDocument();
    });

    it('shows the magic glitter animation over the body icing swatches while the AI mask is generating', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-side',
            itemCategory: 'icing',
            description: 'side',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;
        props.isGeneratingMask = true;

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.getByTestId('magic-glitter')).toBeInTheDocument();
    });

    it('does not show the magic glitter animation when no icing is generating', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-side',
            itemCategory: 'icing',
            description: 'side',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.queryByTestId('magic-glitter')).not.toBeInTheDocument();
    });

    it('shows a pulsing background edit status below the body icing color palette while background editing is pending', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-side',
            itemCategory: 'icing',
            description: 'side',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;
        props.isStudioBackgroundEditingPending = true;

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.getByText('ai is editing your background...')).toBeInTheDocument();
    });

    it('disables body icing swatches while the mask is generating (M2)', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-side',
            itemCategory: 'icing',
            description: 'side',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;
        props.maskStatus = 'generating';

        render(<CustomizingIcingEditorPanel {...props} />);

        // The first color button should be disabled because maskStatus === 'generating'
        // makes the swatch row busy.
        const firstSwatch = screen.getAllByRole('button', { name: /Select .* color/i })[0];
        expect(firstSwatch).toBeDisabled();
    });

    it('does not show a red error banner when the mask lifecycle is in error state since the mask is disabled', () => {
        const props = buildProps();
        props.selectedItem = {
            id: 'icing-edit-side',
            itemCategory: 'icing',
            description: 'side',
            cakeType: '2 Tier',
        } satisfies ClusteredMarker;
        props.maskStatus = 'error';

        render(<CustomizingIcingEditorPanel {...props} />);

        expect(screen.queryByText(/Recolor unavailable/i)).not.toBeInTheDocument();
    });

    it('routes the mask toggle through the provided handler (m9)', () => {
        const props = buildProps();
        props.onToggleMask = vi.fn();

        render(<CustomizingIcingEditorPanel {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /Turn (on|off) icing recolor/i }));

        expect(props.onToggleMask).toHaveBeenCalledTimes(1);
    });
});
