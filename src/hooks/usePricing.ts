import { useState, useCallback, useEffect, useMemo } from 'react';
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
}

export const usePricing = ({
    analysisResult,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    cakeInfo,
    onCakeInfoCorrection,
}: UsePricingProps) => {
    // State for add-on pricing
    const [addOnPricing, setAddOnPricing] = useState<AddOnPricing | null>(null);

    // State for base pricing
    const [basePriceOptions, setBasePriceOptions] = useState<BasePriceInfo[] | null>(null);
    const [isFetchingBasePrice, setIsFetchingBasePrice] = useState<boolean>(false);
    const [basePriceError, setBasePriceError] = useState<string | null>(null);

    // Effect to fetch base price when cake type/thickness changes
    useEffect(() => {
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
                        
                        const currentSizeIsValid = results.some(r => r.size === cakeInfo.size);
                        if (!currentSizeIsValid) {
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
    }, [cakeInfo?.type, cakeInfo?.thickness, cakeInfo?.size, onCakeInfoCorrection]);


    const handleCalculatePrice = useCallback(() => {
        if (!analysisResult || !icingDesign) {
            setAddOnPricing(null);
            return;
        }
        const newPricing = calculatePrice(
            analysisResult,
            { mainToppers, supportElements, cakeMessages, icingDesign }
        );
        setAddOnPricing(newPricing);
    }, [analysisResult, mainToppers, supportElements, cakeMessages, icingDesign]);

    const pricingRelevantStateJSON = useMemo(() => {
        return JSON.stringify({ mainToppers, supportElements, cakeMessages, icingDesign });
    }, [mainToppers, supportElements, cakeMessages, icingDesign]);
    
    useEffect(() => {
        if (analysisResult) {
            handleCalculatePrice();
        }
    }, [pricingRelevantStateJSON, analysisResult, handleCalculatePrice]);

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
        basePriceOptions,
        isFetchingBasePrice,
        basePriceError,
        basePrice,
        finalPrice,
        handleCalculatePrice,
    };
};