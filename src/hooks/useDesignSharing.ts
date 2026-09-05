// hooks/useDesignSharing.ts
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
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
        // A local slug can predate publication. Verify readiness before exposing a public URL.
        if (!slug && !originalImageUrl) return;
        setIsSavingDesign(true);
        try {
            const supabase = createClient();
            let query = supabase
                .from('cakegenie_analysis_cache')
                .select('slug')
                .eq('seo_status', 'published');
            query = slug ? query.eq('slug', slug) : query.eq('original_image_url', originalImageUrl!);
            const { data } = await query.maybeSingle();
            if (data?.slug) {
                setShareData(buildShareData(data.slug));
                setIsShareModalOpen(true);
            } else {
                toast('This design is not ready to share yet.');
            }
        } catch {
            toast.error('Unable to create a share link. Please try again.');
        } finally {
            setIsSavingDesign(false);
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
