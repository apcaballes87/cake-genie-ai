// hooks/useDesignSharing.ts
import { useState, useCallback } from 'react';
// FIX: Import `updateSharedDesignTextsWithRetry` from `shareService` to resolve the "Cannot find name" error.
import { saveDesignToShare, ShareResult, updateSharedDesignTextsWithRetry } from '../services/shareService';
import { generateShareableTexts } from '../services/geminiService';
import { showError } from '../lib/utils/toast';
import {
    CakeInfoUI,
    MainTopperUI,
    SupportElementUI,
    IcingDesignUI,
    HybridAnalysisResult,
    CakeType,
    CartItemDetails,
    CakeMessageUI,
} from '../types';

interface UseDesignSharingProps {
    editedImage: string | null;
    originalImagePreview: string | null;
    cakeInfo: CakeInfoUI | null;
    basePrice: number | undefined;
    finalPrice: number | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    icingDesign: IcingDesignUI | null;
    analysisResult: HybridAnalysisResult | null;
    HEX_TO_COLOR_NAME_MAP: Record<string, string>;
    cakeMessages: CakeMessageUI[];
    additionalInstructions: string;
}

function calculateAvailabilityForSharing(mainToppers: MainTopperUI[], supportElements: SupportElementUI[], icingDesign: IcingDesignUI | null, cakeInfo: CakeInfoUI | null): 'rush' | 'same-day' | 'normal' {
    if (!cakeInfo || !icingDesign) {
        return 'normal';
    }

    // --- Step 1: Check for Absolute "Standard Order" Overrides ---
    const complexTypes: CakeType[] = ['2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle'];
    if (complexTypes.includes(cakeInfo.type) || icingDesign.base === 'fondant') {
        return 'normal';
    }

    // FIX: The 'edible_3d' type no longer exists. Updated to check for related types
    // 'edible_3d_complex' and 'edible_3d_ordinary'.
    const has3dTopper = mainToppers.some(t => t.isEnabled && (t.type === 'edible_3d_complex' || t.type === 'edible_3d_ordinary'));
    const hasDrip = icingDesign.drip;
    const hasGumpasteBase = icingDesign.gumpasteBaseBoard;

    if (has3dTopper || hasDrip || hasGumpasteBase) {
        return 'normal';
    }

    // --- Step 2: Check for Fast-Track Eligibility ---
    const isFastTrackEligible =
        (cakeInfo.type === '1 Tier' && (cakeInfo.size === '6" Round' || cakeInfo.size === '8" Round')) ||
        (cakeInfo.type === 'Bento');

    if (!isFastTrackEligible) {
        return 'normal';
    }

    // --- Step 3: Classify as Same-Day or Rush ---
    // FIX: The 'gumpaste_panel' and 'small_gumpaste' types no longer exist.
    // Updated to check for the current gumpaste support types 'edible_3d_support' and 'edible_2d_support'.
    const hasGumpasteSupport = supportElements.some(s => s.isEnabled && (s.type === 'edible_3d_support' || s.type === 'edible_2d_support'));
    const hasEdiblePhoto =
        mainToppers.some(t => t.isEnabled && t.type === 'edible_photo_top') ||
        supportElements.some(s => s.isEnabled && s.type === 'edible_photo_side');

    if (hasGumpasteSupport || hasEdiblePhoto) {
        return 'same-day';
    }

    // If it passes all checks, it's a Rush order.
    return 'rush';
}


export const useDesignSharing = ({
    editedImage,
    originalImagePreview,
    cakeInfo,
    basePrice,
    finalPrice,
    mainToppers,
    supportElements,
    icingDesign,
    analysisResult,
    HEX_TO_COLOR_NAME_MAP,
    cakeMessages,
    additionalInstructions,
}: UseDesignSharingProps) => {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareData, setShareData] = useState<ShareResult | null>(null);
    const [isSavingDesign, setIsSavingDesign] = useState(false);

    const closeShareModal = () => {
        setIsShareModalOpen(false);
    };

    const createShareLink = useCallback(async () => {
        const imageUrlToShare = editedImage || originalImagePreview;
        if (!imageUrlToShare || !analysisResult || !cakeInfo || basePrice === undefined || finalPrice === null || !icingDesign) {
            showError('Cannot create link: missing design or price information.');
            return;
        }
        setIsSavingDesign(true);
        try {
            const availabilityType = calculateAvailabilityForSharing(mainToppers, supportElements, icingDesign, cakeInfo);
            const accessoriesList = [...mainToppers.filter(t => t.isEnabled).map(t => t.description), ...supportElements.filter(s => s.isEnabled).map(s => s.description)];
            const colorsList: { name: string; hex: string }[] = [];
            if (icingDesign) {
                for (const [colorKey, hex] of Object.entries(icingDesign.colors)) {
                    if (typeof hex === 'string') {
                        const colorName = HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || hex;
                        const keyName = colorKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        colorsList.push({ name: `${keyName}: ${colorName}`, hex });
                    }
                }
            }

            const hexToName = (hex: string) => HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || hex;
            const customizationDetails: CartItemDetails = {
                flavors: cakeInfo.flavors,
                mainToppers: mainToppers.filter(t => t.isEnabled).map(t => ({
                    description: `${t.description} (${t.size})`,
                    type: t.type,
                    size: t.size,
                })),
                supportElements: supportElements.filter(s => s.isEnabled).map(s => ({
                    description: `${s.description} (${s.size})`,
                    type: s.type,
                    size: s.size
                })),
                cakeMessages: cakeMessages.filter(m => m.isEnabled).map(m => ({ text: m.text, color: hexToName(m.color) })),
                icingDesign: {
                    drip: icingDesign.drip, gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
                    colors: Object.entries(icingDesign.colors).reduce((acc, [key, value]) => {
                        if (typeof value === 'string' && value) acc[key] = hexToName(value);
                        return acc;
                    }, {} as Record<string, string>),
                },
                additionalInstructions: additionalInstructions.trim(),
            };

            const designData = {
                customizedImageUrl: imageUrlToShare,
                originalImageUrl: originalImagePreview || undefined,
                cakeType: cakeInfo.type,
                cakeSize: cakeInfo.size,
                cakeFlavor: cakeInfo.flavors.join(', '),
                cakeThickness: cakeInfo.thickness,
                icingColors: colorsList,
                accessories: accessoriesList,
                basePrice,
                finalPrice,
                availabilityType,
                title: `${cakeInfo.size} ${cakeInfo.type} Cake`,
                description: 'A custom cake design from Genie.',
                altText: `A custom ${cakeInfo.type} cake.`,
                customization_details: customizationDetails,
            };

            const result = await saveDesignToShare(designData);

            if (result) {
                setShareData(result);

                (async () => {
                    try {
                        const { title, description, altText } = await generateShareableTexts(
                            analysisResult,
                            cakeInfo,
                            HEX_TO_COLOR_NAME_MAP,
                            editedImage // Pass the edited image for accurate text generation
                        );
                        await updateSharedDesignTextsWithRetry(result.designId, title, description, altText);
                    } catch (enrichError) {
                        console.error('❌ Background enrichment failed:', enrichError);
                    }
                })();
            } else {
                throw new Error("Failed to save design data.");
            }
        } catch (error) {
            showError('Failed to create a shareable link.');
        } finally {
            setIsSavingDesign(false);
        }
    }, [editedImage, originalImagePreview, cakeInfo, basePrice, finalPrice, mainToppers, supportElements, icingDesign, analysisResult, HEX_TO_COLOR_NAME_MAP, cakeMessages, additionalInstructions]);

    const handleShare = useCallback(async () => {
        setShareData(null); // Reset any previous share data
        setIsShareModalOpen(true);
        // Automatically create the share link
        await createShareLink();
    }, [createShareLink]);

    return {
        isShareModalOpen,
        shareData,
        isSavingDesign,
        handleShare,
        createShareLink,
        closeShareModal,
    };
};