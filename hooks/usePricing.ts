import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
    PricingRule,
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
    // State for base pricing
    const [basePriceOptions, setBasePriceOptions] = useState<BasePriceInfo[] | null>(null);
    const [isFetchingBasePrice, setIsFetchingBasePrice] = useState<boolean>(false);
    const [basePriceError, setBasePriceError] = useState<string | null>(null);
    const lastProcessedAnalysisId = useRef<string | null>(null);

    // Effect to fetch base price when cake type/thickness changes, or use initial price
    useEffect(() => {
        if (initialPriceInfo) {
            setBasePriceOptions([initialPriceInfo]);
            onCakeInfoCorrection({ size: initialPriceInfo.size }, { isSystemCorrection: true });
            return;
        }

        if (cakeInfo?.type && cakeInfo?.thickness) {
            const fetchPrice = async () => {
                setIsFetchingBasePrice(true);
                setBasePriceError(null);
                setBasePriceOptions(null);
                try {
                    let results = await getCakeBasePriceOptions(cakeInfo.type, cakeInfo.thickness);
                    let effectiveThickness = cakeInfo.thickness;

                    if (results.length === 0) {
                        const defaultThickness = DEFAULT_THICKNESS_MAP[cakeInfo.type];
                        if (defaultThickness && defaultThickness !== cakeInfo.thickness) {
                            results = await getCakeBasePriceOptions(cakeInfo.type, defaultThickness);
                            effectiveThickness = defaultThickness;
                        }
                    }

                    setBasePriceOptions(results);

                     if (results.length > 0) {
                        const updates: Partial<CakeInfoUI> = {};
                        
                        if (effectiveThickness !== cakeInfo.thickness) {
                            updates.thickness = effectiveThickness;
                        }
                        
                        const isNewAnalysis = analysisId && analysisId !== lastProcessedAnalysisId.current;
                        const currentSizeIsValid = results.some(r => r.size === cakeInfo.size);

                        if (isNewAnalysis) {
                            // On new analysis, always select the cheapest option.
                            const sortedOptions = [...results].sort((a, b) => a.price - b.price);
                            const cheapestOption = sortedOptions[0];
                            updates.size = cheapestOption.size;
                            lastProcessedAnalysisId.current = analysisId; // Mark this analysis ID as processed.
                        } else if (!currentSizeIsValid) {
                            // If not a new analysis (e.g., user changed thickness), and current size is now invalid,
                            // default to the first (cheapest) option available for the new thickness.
                            updates.size = results[0].size;
                        }


                        if (Object.keys(updates).length > 0) {
                            onCakeInfoCorrection(updates, { isSystemCorrection: true });
                        }
                    } else {
                        throw new Error(`We don't have price options for a "${cakeTypeDisplayMap[cakeInfo.type]}" cake. Please try another design.`);
                    }
                } catch (err) {
                    setBasePriceError(err instanceof Error ? err.message : 'Could not fetch size options.');
                } finally {
                    setIsFetchingBasePrice(false);
                }
            };
            fetchPrice();
        }
    }, [cakeInfo?.type, cakeInfo?.thickness, cakeInfo?.size, onCakeInfoCorrection, initialPriceInfo, analysisId]);

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