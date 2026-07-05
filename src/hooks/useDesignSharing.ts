// hooks/useDesignSharing.ts
import { useState, useCallback } from 'react';
import { ShareResult } from '@/services/shareService';
import { createClient } from '@/lib/supabase/client';
import type { CakeInfoUI } from '@/types';

interface UseDesignSharingProps {
    slug: string | null;
    originalImageUrl: string | null;
    cakeInfo?: Pick<CakeInfoUI, 'type' | 'size' | 'thickness'> | null;
}

type CakeOptionSelection = Partial<Pick<CakeInfoUI, 'type' | 'size' | 'thickness'>>;

const buildCakeOptionQuery = (cakeInfo?: CakeOptionSelection | null) => {
    const params = new URLSearchParams();

    if (cakeInfo?.type) params.set('caketype', cakeInfo.type);
    if (cakeInfo?.size) params.set('size', cakeInfo.size);
    if (cakeInfo?.thickness) params.set('height', cakeInfo.thickness);

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
};

export const useDesignSharing = ({ slug, originalImageUrl, cakeInfo }: UseDesignSharingProps) => {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareData, setShareData] = useState<ShareResult | null>(null);
    const [isSavingDesign, setIsSavingDesign] = useState(false);
    const cakeType = cakeInfo?.type ?? null;
    const cakeSize = cakeInfo?.size ?? null;
    const cakeHeight = cakeInfo?.thickness ?? null;

    const closeShareModal = () => {
        setIsShareModalOpen(false);
    };

    const buildShareData = useCallback((resolvedSlug: string) => {
        const clientDomain = typeof window !== 'undefined' ? window.location.origin : 'https://genie.ph';
        const optionQuery = buildCakeOptionQuery({
            type: cakeType ?? undefined,
            size: cakeSize ?? undefined,
            thickness: cakeHeight ?? undefined,
        });
        const shareUrl = `${clientDomain}/customizing/${resolvedSlug}${optionQuery}`;
        const botShareUrl = `https://genie.ph/customizing/${resolvedSlug}${optionQuery}`;

        return {
            designId: '',
            shareUrl,
            botShareUrl,
            urlSlug: resolvedSlug,
        };
    }, [cakeType, cakeSize, cakeHeight]);

    const handleShare = useCallback(async () => {
        // 1. Try slug from props (persistedSlug, URL params, or seoMetadata)
        if (slug) {
            setShareData(buildShareData(slug));
            setIsShareModalOpen(true);
            return;
        }

        // 2. Fallback: query cakegenie_analysis_cache by original_image_url
        if (originalImageUrl) {
            setIsSavingDesign(true);
            setIsShareModalOpen(true);
            try {
                const supabase = createClient();
                const { data } = await supabase
                    .from('cakegenie_analysis_cache')
                    .select('slug')
                    .eq('original_image_url', originalImageUrl)
                    .single();

                if (data?.slug) {
                    setShareData(buildShareData(data.slug));
                    return;
                }
            } catch {
                // Silently handle error fetching slug from cache
            } finally {
                setIsSavingDesign(false);
            }
        }

        // 3. Last resort: share the current page URL as-is
        if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            const pathSlug = currentPath.replace('/customizing/', '').replace('/customizing', '');
            if (pathSlug) {
                setShareData(buildShareData(pathSlug));
                setIsShareModalOpen(true);
            }
        }
    }, [slug, originalImageUrl, buildShareData]);

    return {
        isShareModalOpen,
        shareData,
        isSavingDesign,
        handleShare,
        createShareLink: handleShare,
        closeShareModal,
    };
};
