import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI, IcingDesignUI, MainTopperUI } from '@/types';
import { getRoundedMaterialPriceDelta, useTopperMaterialPriceDeltas } from './useTopperMaterialPriceDeltas';

const mocks = vi.hoisted(() => ({
    calculatePriceFromDatabase: vi.fn(),
}));

vi.mock('@/services/pricingService.database', () => ({
    calculatePriceFromDatabase: mocks.calculatePriceFromDatabase,
}));

const cakeInfo: CakeInfoUI = {
    type: '1 Tier',
    thickness: '3 in',
    size: '6" Round',
    flavors: ['Chocolate Cake'],
};

const icingDesign: IcingDesignUI = {
    base: 'soft_icing',
    color_type: 'single',
    colors: { side: '#ffffff', top: '#ffffff' },
    border_top: false,
    border_base: false,
    drip: false,
    gumpasteBaseBoard: false,
    dripPrice: 0,
    gumpasteBaseBoardPrice: 0,
};

const toySourcePrintout: MainTopperUI = {
    id: 'woody',
    type: 'printout',
    original_type: 'toy',
    printout_source_type: 'toy',
    description: 'Woody',
    size: 'medium',
    quantity: 1,
    group_id: 'toy-story',
    classification: 'hero',
    isEnabled: true,
    price: 0,
};

describe('getRoundedMaterialPriceDelta', () => {
    it('reports a saving against the current rounded customer total', () => {
        expect(getRoundedMaterialPriceDelta(5299, 1500, 1000)).toBe(-500);
    });

    it('reports a surcharge against the current rounded customer total', () => {
        expect(getRoundedMaterialPriceDelta(5299, 500, 800)).toBe(300);
    });

    it('recalculates cached candidates when the current comparison price changes', async () => {
        mocks.calculatePriceFromDatabase.mockResolvedValue({
            addOnPricing: { addOnPrice: 1000, breakdown: [] },
            itemPrices: new Map(),
        });
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        );
        const { result, rerender } = renderHook(
            ({ currentAddOnPrice }: { currentAddOnPrice: number }) => useTopperMaterialPriceDeltas({
                mode: 'toy-toppers',
                mainToppers: [toySourcePrintout],
                supportElements: [],
                cakeMessages: [],
                icingDesign,
                cakeInfo,
                basePrice: 1999,
                currentAddOnPrice,
            }),
            { initialProps: { currentAddOnPrice: 2500 }, wrapper },
        );

        await waitFor(() => expect(result.current.toy).toBe(-1500));

        rerender({ currentAddOnPrice: 0 });

        await waitFor(() => expect(result.current.toy).toBe(1000));
    });
});
