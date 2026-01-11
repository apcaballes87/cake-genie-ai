import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { calculatePriceFromDatabase, clearPricingCache } from '@/services/pricingService.database';
import { getCakeBasePriceOptions } from '@/services/supabaseService';
import {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI,
    AddOnPricing,
    BasePriceInfo,
    CakeType,
    CakeThickness,
} from '@/types';
import { DEFAULT_THICKNESS_MAP } from '@/constants';
import { roundDownToNearest99 } from '@/lib/utils/pricing';

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)',
    '2 Tier': '2 Tier (Soft icing)',
    '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant',
    '2 Tier Fondant': '2 Tier Fondant',
    '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square',
    'Rectangle': 'Rectangle',
    'Bento': 'Bento',
};

const pricingKeys = {
    basePrice: (type?: CakeType, thickness?: CakeThickness) =>
        ['pricing', 'base', type, thickness] as const,
    addOnPrice: (uiState: any) => ['pricing', 'addon', uiState] as const,
};

interface UsePricingProps {
    analysisResult: HybridAnalysisResult | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    cakeInfo: CakeInfoUI | null;
    onCakeInfoCorrection: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    initialPriceInfo?: { size: string; price: number } | null;
    analysisId: string | null;
    merchantId?: string;
}

async function calculateAddOnPrice(uiState: {
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    cakeInfo: CakeInfoUI,
}, merchantId?: string) {
    return await calculatePriceFromDatabase(uiState, merchantId);
}

export const usePricing = ({
    analysisResult,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    cakeInfo,
    onCakeInfoCorrection,
    initialPriceInfo = null,
    analysisId,
    merchantId,
}: UsePricingProps) => {
    const lastProcessedAnalysisId = useRef<string | null>(null);

    const {
        data: queryResult,
        isLoading: isFetchingBasePrice,
        error: queryError,
    } = useQuery({
        queryKey: pricingKeys.basePrice(cakeInfo?.type, cakeInfo?.thickness),
        queryFn: async () => {
            if (!cakeInfo?.type || !cakeInfo?.thickness) {
                return { options: [], effectiveThickness: cakeInfo?.thickness };
            }

            let results = await getCakeBasePriceOptions(cakeInfo.type, cakeInfo.thickness);
            let effectiveThickness = cakeInfo.thickness;

            if (results.length === 0) {
                const defaultThickness = DEFAULT_THICKNESS_MAP[cakeInfo.type];
                if (defaultThickness && defaultThickness !== cakeInfo.thickness) {
                    const fallbackResults = await getCakeBasePriceOptions(cakeInfo.type, defaultThickness);
                    if (fallbackResults.length > 0) {
                        results = fallbackResults;
                        effectiveThickness = defaultThickness;
                    }
                }
            }

            if (results.length === 0) {
                const displayType = cakeTypeDisplayMap[cakeInfo.type] || cakeInfo.type;
                throw new Error(`We don't have price options for a "${displayType}" cake. Please try another design.`);
            }

            return { options: results, effectiveThickness };
        },
        enabled: !!cakeInfo?.type && !!cakeInfo?.thickness && !initialPriceInfo,
        staleTime: 5 * 60 * 1000,
    });

    const basePriceOptions = useMemo(() => {
        if (initialPriceInfo) return [initialPriceInfo];
        return queryResult?.options || null;
    }, [initialPriceInfo, queryResult]);

    const basePriceError = useMemo(() => {
        return queryError ? (queryError as Error).message : null;
    }, [queryError]);

    useEffect(() => {
        if (initialPriceInfo) {
            onCakeInfoCorrection({ size: initialPriceInfo.size }, { isSystemCorrection: true });
            return;
        }

        if (queryResult && cakeInfo) {
            const { options, effectiveThickness } = queryResult;

            if (options.length > 0) {
                const updates: Partial<CakeInfoUI> = {};

                if (effectiveThickness && effectiveThickness !== cakeInfo.thickness) {
                    updates.thickness = effectiveThickness;
                }

                const isNewAnalysis = analysisId && analysisId !== lastProcessedAnalysisId.current;
                const currentSizeIsValid = options.some(r => r.size === cakeInfo.size);

                if (isNewAnalysis) {
                    const sortedOptions = [...options].sort((a, b) => a.price - b.price);
                    updates.size = sortedOptions[0].size;
                    lastProcessedAnalysisId.current = analysisId;
                } else if (!currentSizeIsValid) {
                    updates.size = options[0].size;
                }

                if (Object.keys(updates).length > 0) {
                    onCakeInfoCorrection(updates, { isSystemCorrection: true });
                }
            }
        }
    }, [queryResult, cakeInfo, onCakeInfoCorrection, analysisId, initialPriceInfo]);

    const uiStateForQuery = { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo };
    const {
        data: addonPricingResult,
        isLoading: isCalculatingAddons
    } = useQuery<{ addOnPricing: AddOnPricing | null; itemPrices: Map<string, number> }>({
        queryKey: [...pricingKeys.addOnPrice(uiStateForQuery), merchantId],
        queryFn: () => {
            if (!analysisResult || !icingDesign || !cakeInfo) {
                return Promise.resolve({ addOnPricing: null, itemPrices: new Map<string, number>() });
            }
            return calculateAddOnPrice({ mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo }, merchantId);
        },
        enabled: !!analysisResult && !!icingDesign && !!cakeInfo,
        staleTime: 1 * 60 * 1000,
    });

    const addOnPricing = addonPricingResult?.addOnPricing;
    const itemPrices = addonPricingResult?.itemPrices ?? new Map<string, number>();

    const selectedPriceOption = useMemo(
        () => basePriceOptions?.find(opt => opt.size === cakeInfo?.size),
        [basePriceOptions, cakeInfo?.size]
    );

    const basePrice = selectedPriceOption?.price;

    const finalPrice = useMemo(
        () => {
            if (basePrice === undefined || !addOnPricing) return null;
            const rawPrice = basePrice + addOnPricing.addOnPrice;
            // Round down to nearest 99, but never go below the base price
            return roundDownToNearest99(rawPrice, basePrice);
        },
        [basePrice, addOnPricing]
    );

    return {
        addOnPricing,
        itemPrices,
        basePriceOptions,
        isFetchingBasePrice: isFetchingBasePrice || isCalculatingAddons,
        basePriceError,
        basePrice,
        finalPrice,
        pricingRules: null,
    };
};