// hooks/useDesignSharing.ts
import { useState, useCallback } from 'react';
import { saveDesignToShare, ShareResult } from '../services/shareService';
import { showError } from '../lib/utils/toast';
import {
    CakeInfoUI,
    MainTopperUI,
    SupportElementUI,
    IcingDesignUI,
    HybridAnalysisResult,
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
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareData, setShareData] = useState<ShareResult | null>(null);
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
            const accessoriesList = [...mainToppers.filter(t => t.isEnabled).map(t => t.description), ...supportElements.filter(s => s.isEnabled).map(s => s.description)];
            const colorsList: {name: string, hex: string}[] = [];
            if (icingDesign) {
                for (const [colorKey, hex] of Object.entries(icingDesign.colors)) {
                    if (typeof hex === 'string') {
                        const colorName = HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || hex;
                        const keyName = colorKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        colorsList.push({ name: `${keyName}: ${colorName}`, hex });
                    }
                }
            }
            const result = await saveDesignToShare({
                customizedImageUrl: imageUrlToShare, originalImageUrl: originalImagePreview || undefined, cakeType: cakeInfo.type, cakeSize: cakeInfo.size,
                cakeFlavor: cakeInfo.flavors.join(', '), cakeThickness: cakeInfo.thickness, icingColors: colorsList, accessories: accessoriesList,
                basePrice: basePrice, finalPrice: finalPrice, title: `${cakeInfo.size} ${cakeInfo.type} Cake`, description: `A custom ${cakeInfo.flavors.join(', ')} cake.`
            });
            if (result) {
                setShareData(result);
                setIsShareModalOpen(true);
            }
        } catch (error) {
            showError('Failed to create a shareable link.');
        } finally {
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
