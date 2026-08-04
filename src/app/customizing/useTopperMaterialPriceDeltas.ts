import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI } from '@/types';
import { roundDownToNearest99 } from '@/lib/utils/pricing';
import { calculatePriceFromDatabase } from '@/services/pricingService.database';
import {
    applyAiChatQuickActionMaterial,
    type AiChatQuickActionMode,
    type AiChatTopperMaterialAction,
} from './aiChatQuickActions';

type MaterialPriceDeltas = Partial<Record<AiChatTopperMaterialAction, number | null>>;

const getVisibleMaterialActions = (mode: AiChatQuickActionMode): AiChatTopperMaterialAction[] => {
    if (mode === 'toy-toppers') return ['toy', 'edible', 'printout'];
    if (mode === 'edible-toppers') return ['edible', 'printout'];
    return [];
};

export const getRoundedMaterialPriceDelta = (
    basePrice: number,
    currentAddOnPrice: number,
    candidateAddOnPrice: number,
) => (
    roundDownToNearest99(basePrice + candidateAddOnPrice, basePrice)
    - roundDownToNearest99(basePrice + currentAddOnPrice, basePrice)
);

interface UseTopperMaterialPriceDeltasProps {
    mode: AiChatQuickActionMode;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    cakeInfo: CakeInfoUI | null;
    basePrice?: number;
    currentAddOnPrice?: number;
    merchantId?: string;
}

/**
 * Prices the same deterministic material states that the quick-action buttons
 * apply, so each label reflects the actual rounded customer total.
 */
export const useTopperMaterialPriceDeltas = ({
    mode,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    cakeInfo,
    basePrice,
    currentAddOnPrice,
    merchantId,
}: UseTopperMaterialPriceDeltasProps): MaterialPriceDeltas => {
    const actions = useMemo(() => getVisibleMaterialActions(mode), [mode]);
    const canCalculate = Boolean(
        mode
        && icingDesign
        && cakeInfo
        && typeof basePrice === 'number'
        && typeof currentAddOnPrice === 'number',
    );
    const candidateStates = useMemo(() => actions.map((action) => ({
        action,
        state: applyAiChatQuickActionMaterial(mainToppers, supportElements, mode, action),
    })), [actions, mainToppers, mode, supportElements]);

    const queries = useQueries({
        queries: candidateStates.map(({ action, state }) => ({
            queryKey: [
                'pricing',
                'topper-material-delta',
                action,
                merchantId ?? 'global',
                basePrice,
                currentAddOnPrice,
                JSON.stringify({
                    mainToppers: state.mainToppers,
                    supportElements: state.supportElements,
                    cakeMessages,
                    icingDesign,
                    cakeInfo,
                }),
            ],
            queryFn: async () => {
                const result = await calculatePriceFromDatabase({
                    mainToppers: state.mainToppers,
                    supportElements: state.supportElements,
                    cakeMessages,
                    icingDesign: icingDesign as IcingDesignUI,
                    cakeInfo: cakeInfo as CakeInfoUI,
                }, merchantId);
                return getRoundedMaterialPriceDelta(
                    basePrice as number,
                    currentAddOnPrice as number,
                    result.addOnPricing.addOnPrice,
                );
            },
            enabled: canCalculate && state.changed,
            staleTime: 60_000,
            retry: false,
        })),
    });

    return useMemo(() => candidateStates.reduce<MaterialPriceDeltas>((deltas, { action, state }, index) => {
        deltas[action] = !canCalculate
            ? null
            : state.changed
                ? queries[index]?.data ?? null
                : 0;
        return deltas;
    }, {}), [canCalculate, candidateStates, queries]);
};
