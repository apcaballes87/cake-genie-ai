import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColdCakingPhotoStep } from './ColdCakingPhotoStep';

function renderWithCustomizerShell(props?: Partial<React.ComponentProps<typeof ColdCakingPhotoStep>>) {
    const onUploadClick = vi.fn();

    render(
        <div className="coldcaking-customizer-wrapper">
            <div className="snap-x mt-0">
                <div data-testid="mobile-step-2">
                    <h3>Step 2: Icing Colors</h3>
                </div>
                <div data-testid="mobile-step-3">
                    <h3>Step 3: Cake Toppers</h3>
                </div>
                <div data-testid="mobile-step-4">
                    <h3>Step 4: Cake Messages</h3>
                </div>
            </div>
            <div className="z-60">
                <div data-testid="desktop-step-2">
                    <h3>Step 2: Icing Colors</h3>
                </div>
                <div data-testid="desktop-step-3">
                    <h3>Step 3: Cake Toppers</h3>
                </div>
                <div data-testid="desktop-step-4">
                    <h3>Step 4: Cake Messages</h3>
                </div>
            </div>
            <ColdCakingPhotoStep
                onUploadClick={onUploadClick}
                hasPhoto={false}
                {...props}
            />
        </div>
    );

    return { onUploadClick };
}

describe('ColdCakingPhotoStep', () => {
    it('replaces the step 3 toppers slot and keeps the step 4 cake messages slot visible', async () => {
        renderWithCustomizerShell();

        await waitFor(() => {
            expect(screen.getAllByText('Step 3: Upload Your Photo')).toHaveLength(2);
        });

        expect(screen.getByTestId('mobile-step-2')).not.toHaveStyle({ display: 'none' });
        expect(screen.getByTestId('desktop-step-2')).not.toHaveStyle({ display: 'none' });
        expect(screen.getByTestId('mobile-step-3')).toHaveStyle({ display: 'none' });
        expect(screen.getByTestId('desktop-step-3')).toHaveStyle({ display: 'none' });
        expect(screen.getByTestId('mobile-step-4')).not.toHaveStyle({ display: 'none' });
        expect(screen.getByTestId('desktop-step-4')).not.toHaveStyle({ display: 'none' });
        expect(screen.getAllByRole('button', { name: /upload photo/i })).toHaveLength(2);
        expect(screen.getAllByText('Step 4: Cake Messages')).toHaveLength(2);
    });
});
