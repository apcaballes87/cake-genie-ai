import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_ICING_DESIGN } from '@/constants';
import type { CustomizationState } from './CustomizationContext';
import { CustomizationProvider, useCakeCustomization } from './CustomizationContext';

vi.mock('next/navigation', () => ({
    usePathname: () => '/customizing/test-cake',
}));

vi.mock('@/lib/utils/toast', () => ({
    showSuccess: vi.fn(),
}));

const initialData: CustomizationState = {
    icingDesign: { ...DEFAULT_ICING_DESIGN },
};

function DirtyFieldsHarness() {
    const {
        icingDesign,
        dirtyFields,
        isCustomizationDirty,
        onIcingDesignChange,
        applyFullCustomizationState,
    } = useCakeCustomization();

    if (!icingDesign) return null;

    return (
        <div>
            <button onClick={() => onIcingDesignChange({ ...icingDesign, base: 'fondant' })}>
                change base
            </button>
            <button onClick={() => onIcingDesignChange({ ...icingDesign, border_base: true })}>
                change base border
            </button>
            <button
                onClick={() => applyFullCustomizationState(
                    { icingDesign: { ...icingDesign, drip: true } },
                    { markDirty: true, dirtyFields: ['icingDesign.drip'] },
                )}
            >
                apply pending state
            </button>
            <button onClick={() => applyFullCustomizationState({ icingDesign })}>
                apply clean state
            </button>
            <span data-testid="dirty-state">{String(isCustomizationDirty)}</span>
            <span data-testid="dirty-fields">{[...dirtyFields].sort().join(',')}</span>
        </div>
    );
}

describe('CustomizationProvider dirty-field tracking', () => {
    it('tracks an icing base change independently from the base border', async () => {
        render(
            <CustomizationProvider initialData={initialData}>
                <DirtyFieldsHarness />
            </CustomizationProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'change base' }));

        await waitFor(() => {
            expect(screen.getByTestId('dirty-fields')).toHaveTextContent(/^icingDesign\.base$/);
        });
    });

    it('tracks a base-border change without marking the icing base dirty', async () => {
        render(
            <CustomizationProvider initialData={initialData}>
                <DirtyFieldsHarness />
            </CustomizationProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'change base border' }));

        await waitFor(() => {
            expect(screen.getByTestId('dirty-fields')).toHaveTextContent(/^icingDesign\.border_base$/);
        });
    });

    it('can atomically apply a state while retaining explicit pending dirty fields', async () => {
        render(
            <CustomizationProvider initialData={initialData}>
                <DirtyFieldsHarness />
            </CustomizationProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'apply pending state' }));

        await waitFor(() => {
            expect(screen.getByTestId('dirty-state')).toHaveTextContent('true');
            expect(screen.getByTestId('dirty-fields')).toHaveTextContent(/^icingDesign\.drip$/);
        });
    });

    it('clears dirty state by default when applying a full state', async () => {
        render(
            <CustomizationProvider initialData={initialData}>
                <DirtyFieldsHarness />
            </CustomizationProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'change base' }));
        await waitFor(() => {
            expect(screen.getByTestId('dirty-state')).toHaveTextContent('true');
        });

        fireEvent.click(screen.getByRole('button', { name: 'apply clean state' }));

        await waitFor(() => {
            expect(screen.getByTestId('dirty-state')).toHaveTextContent('false');
            expect(screen.getByTestId('dirty-fields')).toBeEmptyDOMElement();
        });
    });
});
