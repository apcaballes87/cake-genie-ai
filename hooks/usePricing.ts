import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { calculatePrice } from '../services/pricingService';
import { getCakeBasePriceOptions } from '../services/supabaseService';
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
} from '../types';
import { DEFAULT_THICKNESS_MAP } from '../constants';

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
}: UsePricingProps) => {
    const lastProcessedAnalysisId = useRef<string | null>(null);

    const {
        data: queryResult,
        isLoading: isFetchingBasePrice,
        error: queryError,
    } = useQuery({
        // Use optional chaining as cakeInfo can be null initially. `enabled` flag prevents execution.
        queryKey: pricingKeys.basePrice(cakeInfo?.type, cakeInfo?.thickness),
        queryFn: async () => {
            if (!cakeInfo?.type || !cakeInfo?.thickness) {
                return { options: [], effectiveThickness: cakeInfo?.thickness };
            }
            
            let results = await getCakeBasePriceOptions(cakeInfo.type, cakeInfo.thickness);
            let effectiveThickness = cakeInfo.thickness;

            // Fallback logic: If no options, try with the default thickness for the cake type
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
                throw new Error(`We don't have price options for a "${cakeTypeDisplayMap[cakeInfo.type]}" cake. Please try another design.`);
            }

            return { options: results, effectiveThickness };
        },
        enabled: !!cakeInfo?.type && !!cakeInfo?.thickness && !initialPriceInfo,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
    
    const basePriceOptions = useMemo(() => {
        if (initialPriceInfo) return [initialPriceInfo];
        return queryResult?.options || null;
    }, [initialPriceInfo, queryResult]);

    const basePriceError = useMemo(() => {
        return queryError ? (queryError as Error).message : null;
    }, [queryError]);
    
    // This effect handles the side-effect of updating cakeInfo based on fetched price options.
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


    const { addOnPricing, itemPrices } = useMemo(() => {
        if (!analysisResult || !icingDesign || !cakeInfo) {
            return { addOnPricing: null, itemPrices: new Map<string, number>() };
        }
        
        const { addOnPricing: newPricing, itemPrices: newItemPrices } = calculatePrice({
            mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo
        });

        return { addOnPricing: newPricing, itemPrices: newItemPrices };
    }, [analysisResult, mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo]);

    const selectedPriceOption = useMemo(
        () => basePriceOptions?.find(opt => opt.size === cakeInfo?.size), 
        [basePriceOptions, cakeInfo?.size]
    );

    const basePrice = selectedPriceOption?.price;

    const finalPrice = useMemo(
        () => (basePrice !== undefined && addOnPricing ? basePrice + addOnPricing.addOnPrice : null), 
        [basePrice, addOnPricing]
    );

    return {
        addOnPricing,
        itemPrices,
        basePriceOptions,
        isFetchingBasePrice,
        basePriceError,
        basePrice,
        finalPrice,
        pricingRules: null, // Rules are no longer fetched
    };
};