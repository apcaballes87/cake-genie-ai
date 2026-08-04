import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CakeDesignQuickActions } from './CakeDesignQuickActions';

const buildProps = (): React.ComponentProps<typeof CakeDesignQuickActions> => ({
    mode: 'toy-toppers',
    selectedAction: 'edible',
    isDisabled: false,
    isPhotoUploading: false,
    onEdiblePhotoUpload: vi.fn(),
    onTopperMaterialAction: vi.fn(),
    onOpenToppers: vi.fn(),
});

describe('CakeDesignQuickActions', () => {
    it('matches the Soft Icing control treatment and forwards direct choices', () => {
        const props = buildProps();
        render(<CakeDesignQuickActions {...props} />);

        const quickActions = screen.getByLabelText('Cake design quick actions');
        expect(quickActions).toHaveClass('w-full');
        expect(screen.getByText('Topper Types')).toHaveClass(
            'text-[10px]',
            'max-md:text-[9px]',
            'font-bold',
            'text-slate-400',
            'uppercase',
            'tracking-wider',
        );
        for (const name of ['All Toys', 'All Edible Toppers', 'All Printout', 'Open toppers bottom sheet']) {
            expect(screen.getByRole('button', { name })).toHaveClass(
                'min-h-[32px]',
                'max-md:min-h-[34px]',
                'rounded-xl',
                'border',
                'transition-all',
                'duration-300',
            );
        }
        for (const name of ['All Toys', 'All Edible Toppers', 'All Printout']) {
            expect(screen.getByRole('button', { name })).toHaveClass('flex-1', 'flex-wrap', 'content-center', 'gap-x-1');
            expect(screen.getByText(name)).toHaveClass('whitespace-nowrap', 'leading-tight');
        }
        expect(screen.getByRole('button', { name: 'All Edible Toppers' })).toHaveClass('genie-control-selected', 'text-purple-700', 'scale-[1.02]');
        expect(screen.getByRole('button', { name: 'All Edible Toppers' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'All Toys' })).toHaveClass('border-slate-200', 'bg-slate-50', 'text-slate-600');
        expect(screen.getByRole('button', { name: 'All Toys' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'All Printout' })).toHaveClass('border-slate-200', 'bg-slate-50', 'text-slate-600');
        expect(quickActions.querySelectorAll('.bg-black')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'All Toys' }));
        fireEvent.click(screen.getByRole('button', { name: 'All Edible Toppers' }));
        fireEvent.click(screen.getByRole('button', { name: 'All Printout' }));
        fireEvent.click(screen.getByRole('button', { name: 'Open toppers bottom sheet' }));

        expect(props.onTopperMaterialAction).toHaveBeenNthCalledWith(1, 'toy');
        expect(props.onTopperMaterialAction).toHaveBeenNthCalledWith(2, 'edible');
        expect(props.onTopperMaterialAction).toHaveBeenNthCalledWith(3, 'printout');
        expect(props.onOpenToppers).toHaveBeenCalledTimes(1);
    });

    it('uses the purple default state for printout topper designs', () => {
        const props = buildProps();
        props.selectedAction = 'printout';

        render(<CakeDesignQuickActions {...props} />);

        expect(screen.getByRole('button', { name: 'All Printout' })).toHaveClass('genie-control-selected', 'text-purple-700', 'scale-[1.02]');
        expect(screen.getByRole('button', { name: 'All Printout' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'All Edible Toppers' })).toHaveClass('border-slate-200');
        expect(screen.getByRole('button', { name: 'All Toys' })).toHaveClass('border-slate-200');
    });

    it('shows signed material price deltas beside the relevant button labels', () => {
        const props = buildProps();
        props.priceDeltas = { edible: 300, printout: -500 };

        render(<CakeDesignQuickActions {...props} />);

        expect(screen.getByText('+₱300')).toHaveClass('text-emerald-600', 'whitespace-nowrap', 'leading-tight');
        expect(screen.getByText('-₱500')).toHaveClass('text-red-600', 'whitespace-nowrap', 'leading-tight');
        expect(screen.queryByText('+₱0')).not.toBeInTheDocument();
    });

    it('renders the edible-photo upload action and forwards the selected file without chat state', () => {
        const props = buildProps();
        props.mode = 'edible-photo';

        const { container } = render(<CakeDesignQuickActions {...props} />);
        const file = new File(['photo'], 'new-photo.png', { type: 'image/png' });
        const fileInput = container.querySelector('input[aria-label="Choose image for edible photo"]') as HTMLInputElement;

        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(props.onEdiblePhotoUpload).toHaveBeenCalledWith(file);
        expect(screen.getByLabelText('Cake design quick actions')).toHaveTextContent('Upload Image for Edible Photo');
    });
});
