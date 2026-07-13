import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI, IcingDesignUI } from '@/types';

const mocks = vi.hoisted(() => ({
    getCakeBasePriceOptions: vi.fn(),
    calculatePriceFromDatabase: vi.fn(),
}));

vi.mock('@/services/supabaseService', () => ({
    getCakeBasePriceOptions: mocks.getCakeBasePriceOptions,
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
    colors: { side: '#f5deb3', top: '#ffffff' },
    border_top: false,
    border_base: false,
    drip: false,
    gumpasteBaseBoard: false,
    dripPrice: 0,
    gumpasteBaseBoardPrice: 0,
};

describe('usePricing icing type comparisons', () => {
    it('loads the counterpart delta without an analysis result', async () => {
        mocks.calculatePriceFromDatabase.mockResolvedValue({
            addOnPricing: { addOnPrice: 0, breakdown: [] },
            itemPrices: new Map(),
        });
        mocks.getCakeBasePriceOptions.mockImplementation(async (type: string, thickness: string) => {
            if (type === '1 Tier' && thickness === '3 in') {
                return [{ size: '6" Round', price: 1199 }];
            }
            if (type === '1 Tier Fondant' && thickness === '5 in') {
                return [{ size: '6" Round Fondant', price: 1999 }];
            }
            return [];
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );

        const { usePricing } = await import('./usePricing');
        const { result } = renderHook(() => usePricing({
            analysisResult: null,
            mainToppers: [],
            supportElements: [],
            cakeMessages: [],
            icingDesign,
            cakeInfo,
            onCakeInfoCorrection: vi.fn(),
            analysisId: null,
        }), { wrapper });

        await waitFor(() => {
            expect(result.current.icingTypePriceDeltas.fondant).toBe(800);
        });
    });
});
