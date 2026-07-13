import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { calculatePriceFromDatabase } from '@/services/pricingService.database';
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
import {
    DEFAULT_THICKNESS_MAP,
    getEquivalentCakeTypeForIcingBase,
    THICKNESS_OPTIONS_MAP,
} from '@/constants';
import { roundDownToNearest99 } from '@/lib/utils/pricing';
import { withTimeout } from '@/lib/utils/timeout';
import { calculateIcingTypePriceDelta, type IcingPriceOption } from '@/lib/pricing/icingTypePrice';

const PRICING_QUERY_TIMEOUT_MS = 8_000;

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
    'Square Fondant': 'Square Fondant',
    'Rectangle Fondant': 'Rectangle Fondant',
    'Cupcake': 'Cupcake',
    'Bento Cupcake Set': 'Bento Cupcake Set',
};

const pricingKeys = {
    basePrice: (type?: CakeType, thickness?: CakeThickness) =>
        ['pricing', 'base', type, thickness] as const,
    addOnPrice: (uiStateKey: string, merchantId?: string) => ['pricing', 'addon', uiStateKey, merchantId] as const,
    icingTypePriceDelta: (
        type?: CakeType,
        thickness?: CakeThickness,
        size?: string,
        icingBase?: IcingDesignUI['base'] | null,
        currentPrice?: number,
    ) => ['pricing', 'icing-type-delta', type, thickness, size, icingBase, currentPrice] as const,
};

type PricingUiState = {
    mainToppers: MainTopperUI[]
    supportElements: SupportElementUI[]
    cakeMessages: CakeMessageUI[]
    icingDesign: IcingDesignUI
    cakeInfo: CakeInfoUI
}

export function buildPricingUiStateKey(uiState: PricingUiState | null): string {
    if (!uiState) return 'no-pricing-ui-state'

    return JSON.stringify(uiState)
}

interface UsePricingProps {
    analysisResult: HybridAnalysisResult | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    cakeInfo: CakeInfoUI | null;
    onCakeInfoCorrection: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    initialPriceInfo?: BasePriceInfo | null;
    analysisId: string | null;
    merchantId?: string;
}

async function calculateAddOnPrice(uiState: PricingUiState, merchantId?: string) {
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
        isPlaceholderData,
        refetch: refetchBasePrice,
    } = useQuery({
        queryKey: pricingKeys.basePrice(cakeInfo?.type, cakeInfo?.thickness),
        queryFn: async () => {
            if (!cakeInfo?.type || !cakeInfo?.thickness) {
                return { options: [], effectiveThickness: cakeInfo?.thickness };
            }

            let results = await withTimeout(
                getCakeBasePriceOptions(cakeInfo.type, cakeInfo.thickness),
                PRICING_QUERY_TIMEOUT_MS,
                'Pricing lookup timed out. Please retry.',
            );
            let effectiveThickness = cakeInfo.thickness;

            if (results.length === 0) {
                const defaultThickness = DEFAULT_THICKNESS_MAP[cakeInfo.type];
                if (defaultThickness && defaultThickness !== cakeInfo.thickness) {
                    const fallbackResults = await withTimeout(
                        getCakeBasePriceOptions(cakeInfo.type, defaultThickness),
                        PRICING_QUERY_TIMEOUT_MS,
                        'Fallback pricing lookup timed out. Please retry.',
                    );
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
        placeholderData: keepPreviousData,
        retry: false,
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

        // Avoid performing corrections using stale/placeholder data (from previous query keys)
        // while the new base price options for the selected cake type/thickness are being fetched.
        if (isPlaceholderData) {
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

                const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                const hasUrlSize = urlParams?.has('size');

                if (isNewAnalysis && !hasUrlSize) {
                    const sortedOptions = [...options].sort((a, b) => a.price - b.price);
                    updates.size = sortedOptions[0].size;
                    lastProcessedAnalysisId.current = analysisId;
                } else {
                    if (isNewAnalysis) {
                        lastProcessedAnalysisId.current = analysisId;
                    }
                    if (!currentSizeIsValid) {
                        updates.size = options[0].size;
                    }
                }

                if (Object.keys(updates).length > 0) {
                    onCakeInfoCorrection(updates, { isSystemCorrection: true });
                }
            }
        }
    }, [queryResult, cakeInfo, onCakeInfoCorrection, analysisId, initialPriceInfo, isPlaceholderData]);

    const uiStateForQuery = useMemo<PricingUiState | null>(() => {
        if (!icingDesign || !cakeInfo) return null;

        return {
            mainToppers,
            supportElements,
            cakeMessages,
            icingDesign,
            cakeInfo,
        };
    }, [mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo]);

    const pricingUiStateKey = useMemo(() => buildPricingUiStateKey(uiStateForQuery), [uiStateForQuery]);

    const {
        data: addonPricingResult,
        isLoading: isCalculatingAddons,
        refetch: refetchAddonPricing,
    } = useQuery<{ addOnPricing: AddOnPricing | null; itemPrices: Map<string, number> }>({
        queryKey: pricingKeys.addOnPrice(pricingUiStateKey, merchantId),
        queryFn: () => {
            if (!analysisResult || !uiStateForQuery) {
                return Promise.resolve({ addOnPricing: null, itemPrices: new Map<string, number>() });
            }
            return withTimeout(
                calculateAddOnPrice(uiStateForQuery, merchantId),
                PRICING_QUERY_TIMEOUT_MS,
                'Add-on pricing timed out. Please retry.',
            );
        },
        enabled: !!analysisResult && !!uiStateForQuery,
        staleTime: 1 * 60 * 1000,
        retry: false,
    });

    const addOnPricing = addonPricingResult?.addOnPricing;
    const itemPrices = addonPricingResult?.itemPrices ?? new Map<string, number>();

    const selectedPriceOption = useMemo(
        () => basePriceOptions?.find(opt => opt.size === cakeInfo?.size),
        [basePriceOptions, cakeInfo?.size]
    );

    const basePrice = selectedPriceOption?.price;

    const currentIcingBase: IcingDesignUI['base'] | null = cakeInfo && icingDesign
        ? (cakeInfo.type.toLowerCase().includes('fondant') || icingDesign.base === 'fondant'
            ? 'fondant'
            : 'soft_icing')
        : null;

    const { data: icingTypePriceDeltas } = useQuery<Record<IcingDesignUI['base'], number | null>>({
        queryKey: pricingKeys.icingTypePriceDelta(
            cakeInfo?.type,
            cakeInfo?.thickness,
            cakeInfo?.size,
            currentIcingBase,
            basePrice,
        ),
        queryFn: async () => {
            const emptyDeltas: Record<IcingDesignUI['base'], number | null> = {
                soft_icing: null,
                fondant: null,
            };

            if (!cakeInfo || !icingDesign || !basePriceOptions || !currentIcingBase) {
                return emptyDeltas;
            }

            const alternateBase: IcingDesignUI['base'] = currentIcingBase === 'fondant'
                ? 'soft_icing'
                : 'fondant';
            const alternateType = getEquivalentCakeTypeForIcingBase(cakeInfo.type, alternateBase);
            const alternateThicknesses = THICKNESS_OPTIONS_MAP[alternateType] || [];

            try {
                const counterpartOptions = (await Promise.all(
                    alternateThicknesses.map(async (thickness) => {
                        const options = await withTimeout(
                            getCakeBasePriceOptions(alternateType, thickness),
                            PRICING_QUERY_TIMEOUT_MS,
                            'Icing type pricing lookup timed out.',
                        );
                        return options.map(option => ({ ...option, thickness }));
                    }),
                )).flat() as IcingPriceOption[];

                return {
                    ...emptyDeltas,
                    [alternateBase]: calculateIcingTypePriceDelta({
                        currentOptions: basePriceOptions,
                        counterpartOptions,
                        currentSize: cakeInfo.size,
                        currentThickness: cakeInfo.thickness,
                    }),
                };
            } catch {
                // The delta is an enhancement; the main pricing query remains authoritative.
                return emptyDeltas;
            }
        },
        enabled: Boolean(
            cakeInfo
            && icingDesign
            && currentIcingBase
            && basePriceOptions?.length
            && basePrice !== undefined,
        ),
        staleTime: 1 * 60 * 1000,
        retry: false,
    });

    const finalPrice = useMemo(
        () => {
            if (basePrice === undefined || !addOnPricing) return null;
            const rawPrice = basePrice + addOnPricing.addOnPrice;
            // Round down to nearest 99, but never go below the base price
            return roundDownToNearest99(rawPrice, basePrice);
        },
        [basePrice, addOnPricing]
    );

    const retryPricing = useCallback(async () => {
        await Promise.all([refetchBasePrice(), refetchAddonPricing()]);
    }, [refetchAddonPricing, refetchBasePrice]);

    return {
        addOnPricing,
        itemPrices,
        basePriceOptions,
        isFetchingBasePrice: isFetchingBasePrice || isCalculatingAddons,
        basePriceError,
        basePrice,
        finalPrice,
        icingTypePriceDeltas: icingTypePriceDeltas ?? { soft_icing: null, fondant: null },
        retryPricing,
        pricingRules: null,
    };
};
