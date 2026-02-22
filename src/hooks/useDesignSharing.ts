// hooks/useDesignSharing.ts
import { useState, useCallback } from 'react';
import { ShareResult } from '@/services/shareService';
import { createClient } from '@/lib/supabase/client';

interface UseDesignSharingProps {
    slug: string | null;
    originalImageUrl: string | null;
}

export const useDesignSharing = ({ slug, originalImageUrl }: UseDesignSharingProps) => {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareData, setShareData] = useState<ShareResult | null>(null);
    const [isSavingDesign, setIsSavingDesign] = useState(false);

    const closeShareModal = () => {
        setIsShareModalOpen(false);
    };

    const buildShareData = (resolvedSlug: string) => {
        const clientDomain = typeof window !== 'undefined' ? window.location.origin : 'https://genie.ph';
        const shareUrl = `${clientDomain}/customizing/${resolvedSlug}`;
        const botShareUrl = `https://genie.ph/customizing/${resolvedSlug}`;

        return {
            designId: '',
            shareUrl,
            botShareUrl,
            urlSlug: resolvedSlug,
        };
    };

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
            } catch (error) {
                console.error('Failed to fetch slug from cache:', error);
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
    }, [slug, originalImageUrl]);

    return {
        isShareModalOpen,
        shareData,
        isSavingDesign,
        handleShare,
        createShareLink: handleShare,
        closeShareModal,
    };
};