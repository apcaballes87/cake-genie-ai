// hooks/useDesignSharing.ts
import { useState, useCallback } from 'react';
import { saveDesignToShare, ShareResult, updateSharedDesignTextsWithRetry } from '../services/shareService';
import { generateShareableTexts } from '../services/geminiService.lazy';
import { showError } from '../lib/utils/toast';
import {
    CakeInfoUI,
    MainTopperUI,
    SupportElementUI,
    IcingDesignUI,
    HybridAnalysisResult,
    CakeType,
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
    
    const has3dTopper = mainToppers.some(t => t.isEnabled && t.type === 'edible_3d');
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
    const hasGumpasteSupport = supportElements.some(s => s.isEnabled && (s.type === 'gumpaste_panel' || s.type === 'small_gumpaste'));
    const hasEdiblePhoto = 
        mainToppers.some(t => t.isEnabled && t.type === 'edible_photo') || 
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
}: UseDesignSharingProps) => {
    interface ExtendedShareResult extends ShareResult {
    botShareUrl?: string;
}

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareData, setShareData] = useState<ExtendedShareResult | null>(null);
    const [isSavingDesign, setIsSavingDesign] = useState(false);

    const openShareModal = () => setIsShareModalOpen(true);
    const closeShareModal = () => setIsShareModalOpen(false);

    const handleShare = useCallback(async () => {
        const imageUrlToShare = editedImage || originalImagePreview;
        if (!imageUrlToShare || !analysisResult || !cakeInfo || basePrice === undefined || finalPrice === null) {
            showError('Price information is missing or design is not analyzed.');
            return;
        }
        setIsSavingDesign(true);
        try {
            // --- Step 1: Immediate Save with Placeholders ---
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
            
            const initialData = {
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
            };

            const result = await saveDesignToShare(initialData);

            if (result) {
    // Generate share URL that works with bots (via Vercel proxy to Supabase Edge Function)
    const shareUrlForBots = `https://genie.ph/share/${result.designId}`;
    
    // --- UI is now responsive ---
    setShareData({
        ...result,
        shareUrl: result.shareUrl, // Original React app URL for humans
        botShareUrl: shareUrlForBots, // Optimized URL for social media bots
    });
    setIsShareModalOpen(true);
    setIsSavingDesign(false);

                // --- Step 2: Background Enrichment (Fire-and-forget) ---
                (async () => {
                    try {
                        const { title, description, altText } = await generateShareableTexts(
                            analysisResult,
                            cakeInfo,
                            HEX_TO_COLOR_NAME_MAP
                        );
                        console.log('🤖 AI generated marketing text for design:', result.designId);
                        
                        await updateSharedDesignTextsWithRetry(result.designId, title, description, altText);
                        
                        console.log('✅ Successfully enriched shared design in background');
                        
                    } catch (enrichError) {
                        console.error('❌ Background enrichment failed:', enrichError);
                        // This warning is helpful for debugging without alerting the user.
                        console.warn('💡 Design was shared successfully, but AI enhancement failed. Placeholder text will be used.');
                    }
                })();
            } else {
                throw new Error("Failed to save initial design data.");
            }
        } catch (error) {
            showError('Failed to create a shareable link.');
            setIsSavingDesign(false);
        }
    }, [editedImage, originalImagePreview, cakeInfo, basePrice, finalPrice, mainToppers, supportElements, icingDesign, HEX_TO_COLOR_NAME_MAP, analysisResult]);

    return {
        isShareModalOpen,
        shareData,
        isSavingDesign,
        handleShare,
        openShareModal,
        closeShareModal,
    };
};