import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { derivePrintoutConversionSummary } from '@/app/customizing/printoutConversion';
import type { CustomizationState } from './CustomizationContext';
import { CustomizationProvider, useCakeCustomization } from './CustomizationContext';

vi.mock('next/navigation', () => ({
    usePathname: () => '/customizing/test-cake',
}));

vi.mock('@/lib/utils/toast', () => ({
    showSuccess: vi.fn(),
}));

const initialData: CustomizationState = {
    mainToppers: [{
        id: 'toy-topper',
        type: 'toy',
        original_type: 'toy',
        material: 'plastic',
        description: 'character figure',
        size: 'medium',
        quantity: 1,
        group_id: 'characters',
        classification: 'hero',
        isEnabled: true,
        price: 0,
    }],
    supportElements: [],
    analysisResult: {
        cakeType: '1 Tier',
        cakeThickness: '4 in',
        main_toppers: [{
            type: 'toy',
            material: 'plastic',
            description: 'character figure',
            size: 'medium',
            quantity: 1,
            group_id: 'characters',
            classification: 'hero',
        }],
        support_elements: [],
        cake_messages: [],
    },
};

function ConversionHarness() {
    const {
        mainToppers,
        updateMainTopper,
        syncAnalysisResultWithCurrentState,
    } = useCakeCustomization();
    const topper = mainToppers[0];
    const summary = derivePrintoutConversionSummary(mainToppers);

    return (
        <div>
            <button onClick={() => updateMainTopper(topper.id, { type: 'printout' })}>convert</button>
            <button onClick={syncAnalysisResultWithCurrentState}>commit</button>
            <span data-testid="type">{topper.type}</span>
            <span data-testid="original-type">{topper.original_type}</span>
            <span data-testid="source-type">{topper.printout_source_type ?? ''}</span>
            <span data-testid="has-toy-notice">{String(summary.toy)}</span>
        </div>
    );
}

describe('CustomizationProvider printout conversion provenance', () => {
    it('keeps the toy source and notification after the converted design is committed', async () => {
        render(
            <CustomizationProvider initialData={initialData}>
                <ConversionHarness />
            </CustomizationProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'convert' }));

        await waitFor(() => {
            expect(screen.getByTestId('type')).toHaveTextContent('printout');
            expect(screen.getByTestId('source-type')).toHaveTextContent('toy');
            expect(screen.getByTestId('has-toy-notice')).toHaveTextContent('true');
        });

        fireEvent.click(screen.getByRole('button', { name: 'commit' }));

        await waitFor(() => {
            expect(screen.getByTestId('original-type')).toHaveTextContent('printout');
            expect(screen.getByTestId('source-type')).toHaveTextContent('toy');
            expect(screen.getByTestId('has-toy-notice')).toHaveTextContent('true');
        });
    });
});
