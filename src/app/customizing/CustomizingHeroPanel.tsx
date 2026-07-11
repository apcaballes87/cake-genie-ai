'use client';

import { memo, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import LazyImage from '@/components/LazyImage';
import { ImageZoomModal } from '@/components/ImageZoomModal';
import { Heart, ShieldCheck, Wand2 } from 'lucide-react';
import { ErrorIcon, ImageIcon, ResetIcon, SaveIcon, Loader2, ReportIcon } from '../../components/icons';
import MagicGlitter from '@/components/MagicGlitter';
import { getCustomerFacingAnalysisError } from './analysisErrorDisplay';
import { useDynamicLoadingPhrase } from '@/hooks/useDynamicLoadingPhrase';
import { buildSrcSet } from '@/lib/imageVariants/manifest';
import type { VariantManifest } from '@/lib/imageVariants/types';


type ImageTab = 'original' | 'customized';

interface CustomizingHeroPanelProps {
    mainImageContainerRef: RefObject<HTMLDivElement | null>;
    editedImage: string | null;
    activeTab: ImageTab;
    isAnalyzing: boolean;
    isUpdatingDesign: boolean;
    isStudioBackgroundEditingPending?: boolean;
    isComposingSelfie?: boolean;
    dynamicLoadingMessage: string;
    error: string | null;
    originalImagePreview: string | null;
    preferredOriginalImageUrl: string | null;
    preloadedHeroImage: string | null;
    fallbackImageUrl: string | null;
    fallbackImageAlt: string;
    fallbackImageTitle: string;
    initialCaption?: string;
    heroImageAlt: string;
    heroImageTitle: string;
    showSaveDesignButton: boolean;
    isCurrentDesignSaved: boolean;
    canUndo: boolean;
    isLoading: boolean;
    isReporting: boolean;
    isSaving: boolean;
    showFooterActions: boolean;
    showPriceGuarantee: boolean;
    showMotifButton?: boolean;
    isCombining?: boolean;
    enableMobileHeroPan?: boolean;
    onOriginalTabSelect: () => void;
    onCustomizedTabSelect: () => void;
    onToggleSaveDesign: () => void | Promise<void>;
    onUndo: () => void;
    onOpenMotifPanel?: () => void;
    onOpenReportModal: () => void;
    onSave: () => void;
    onClearAll: () => void;
    /**
     * Aspect ratio (width / height) of the hero image from the DB
     * (`image_width` / `image_height`), e.g. "400 / 534". Used to reserve the
     * correct hero height BEFORE the image loads so the desktop layout doesn't
     * shift (the desktop hero is a native `<img h-auto>` with no intrinsic
     * box). Falls back to the measured ratio once the image's onLoad fires.
     */
    initialHeroAspectRatio?: string | null;
    heroImageVariants?: VariantManifest | null;
    reviewSummary?: {
        total: number;
        averageRating: number;
    } | null;
}

const NativeFadeOverlayImage = ({
    src,
    alt,
    title,
    className,
    onLoad,
}: {
    src: string;
    alt: string;
    title: string;
    className: string;
    onLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        // eslint-disable-next-line @next/next/no-img-element -- The overlay mirrors the natural source aspect ratio while fading in on load.
        <img
            src={src}
            alt={alt}
            title={title}
            className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={(event) => {
                setIsLoaded(true);
                onLoad(event);
            }}
        />
    );
};

export interface HeroActionButtonsRowProps {
    editedImage: string | null;
    isLoading: boolean;
    isReporting: boolean;
    isSaving: boolean;
    onOpenReportModal: () => void;
    onSave: () => void;
    onClearAll: () => void;
}

export const HeroActionButtonsRow = ({ editedImage, isLoading, isReporting, isSaving, onOpenReportModal, onSave, onClearAll }: HeroActionButtonsRowProps) => {
    const buttonClassName = 'flex items-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
    const iconClassName = 'w-3.5 h-3.5';

    return (
        <div className="flex items-center justify-center flex-nowrap gap-2 overflow-x-auto py-0.5 px-1 scrollbar-hide w-full mx-auto">
            <button onClick={onOpenReportModal} disabled={!editedImage || isLoading || isReporting} className={buttonClassName} aria-label="Report an issue">
                <ReportIcon className={`${iconClassName} text-slate-400 shrink-0`} />
                <span>{isReporting ? 'Submitting...' : 'Report Issue'}</span>
            </button>

            <button onClick={onSave} disabled={!editedImage || isLoading || isSaving} className={buttonClassName} aria-label="Save customized image">
                {isSaving ? (
                    <Loader2 className={`${iconClassName} animate-spin text-purple-500 shrink-0`} />
                ) : (
                    <SaveIcon className={`${iconClassName} text-green-600 shrink-0`} />
                )}
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>

            <button onClick={onClearAll} className={`${buttonClassName} border-red-100 text-red-600 hover:bg-red-50`} aria-label="Reset everything">
                <ResetIcon className={`${iconClassName} text-red-500 shrink-0`} />
                <span>Reset Everything</span>
            </button>
        </div>
    );
};

const reviewSeparator = (
    <span aria-hidden="true" className="text-slate-300">
        |
    </span>
);

const reviewStars: ReactNode[] = Array.from({ length: 5 }, (_, index) => (
    <span key={index} aria-hidden="true" className="tracking-tight text-amber-400">
        ★
    </span>
));

const MOBILE_HERO_FRAME_RATIO = 5 / 4;

const parseAspectRatioValue = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const [rawWidth, rawHeight] = value.split('/').map((part) => Number(part.trim()));
    if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawHeight <= 0) {
        return null;
    }

    return rawWidth / rawHeight;
};

export const CustomizingHeroPanel = memo(({
    mainImageContainerRef,
    editedImage,
    activeTab,
    isAnalyzing,
    isUpdatingDesign,
    isStudioBackgroundEditingPending = false,
    isComposingSelfie = false,
    dynamicLoadingMessage,
    error,
    originalImagePreview,
    preferredOriginalImageUrl,
    preloadedHeroImage,
    fallbackImageUrl,
    fallbackImageAlt,
    fallbackImageTitle,
    initialCaption,
    heroImageAlt,
    heroImageTitle,
    showSaveDesignButton,
    isCurrentDesignSaved,
    canUndo,
    isLoading,
    isReporting,
    isSaving,
    showFooterActions,
    showPriceGuarantee,
    showMotifButton = false,
    isCombining,
    enableMobileHeroPan = false,
    onOriginalTabSelect,
    onCustomizedTabSelect,
    onToggleSaveDesign,
    onUndo,
    onOpenMotifPanel,
    onOpenReportModal,
    onSave,
    onClearAll,
    reviewSummary,
    initialHeroAspectRatio = null,
    heroImageVariants = null,
}: CustomizingHeroPanelProps) => {
    const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [isHeroImageZoomOpen, setIsHeroImageZoomOpen] = useState(false);
    const { phrase: dynamicAnalysisPhrase, isVisible: isAnalysisPhraseVisible } = useDynamicLoadingPhrase(isAnalyzing);
    const mobileHeroScrollRef = useRef<HTMLDivElement | null>(null);
    const baseOriginalImageUrl = originalImagePreview || preferredOriginalImageUrl || null;
    const incomingStudioImageUrl = (
        activeTab === 'original'
        && originalImagePreview
        && preferredOriginalImageUrl
        && preferredOriginalImageUrl !== originalImagePreview
    ) ? preferredOriginalImageUrl : null;
    const originalHeroModalSrc = preferredOriginalImageUrl || originalImagePreview || preloadedHeroImage || fallbackImageUrl || '';
    const hasOriginalDisplayImage = Boolean(baseOriginalImageUrl);
    // When the studio (preferred) image is known and differs from the user's
    // upload preview, render it directly as the base hero. The previous double
    // layer (user image + studio overlay) cost an extra HTTP image request and
    // a paint cycle; the LazyImage's own opacity transition still gives a
    // smooth load-in, and the modal still uses originalHeroModalSrc which
    // preserves the original-image option.
    const preferredBaseHeroUrl = incomingStudioImageUrl || baseOriginalImageUrl;
    const heroDisplaySrc = activeTab === 'customized'
        ? (editedImage || originalHeroModalSrc || '')
        : (preferredBaseHeroUrl || preloadedHeroImage || fallbackImageUrl || '');
    // Once the base img IS the studio image, the separate overlay becomes
    // redundant; keep the overlay only when we cannot promote it (e.g. when
    // baseOriginalImageUrl is empty — pre-upload product preview).
    const shouldRenderStudioOverlay = Boolean(
        incomingStudioImageUrl && preferredBaseHeroUrl !== incomingStudioImageUrl
    );
    const heroDisplayTitle = heroImageTitle;
    const customerFacingError = error ? getCustomerFacingAnalysisError(error) : null;
    // Prefer measured dimensions once the image loads; before that, use the
    // DB-provided ratio so the box is reserved at the correct height and the
    // desktop layout doesn't shift on image load. Final fallback 1/1.
    const heroImageRatio = originalImageDimensions
        ? `${originalImageDimensions.width} / ${originalImageDimensions.height}`
        : (initialHeroAspectRatio || '1 / 1');
    const heroImageRatioValue = originalImageDimensions
        ? (originalImageDimensions.width / originalImageDimensions.height)
        : parseAspectRatioValue(heroImageRatio);
    const shouldUseScrollableMobileHero = Boolean(
        enableMobileHeroPan
        && heroImageRatioValue
        && heroImageRatioValue < MOBILE_HERO_FRAME_RATIO
    );
    const heroVariantSrcSet = heroImageVariants?.variants.length ? buildSrcSet(heroImageVariants) : '';
    const heroVariantSizes = '(max-width: 768px) 100vw, 50vw';
    const shouldUseHeroVariantsForSrc = (src: string) => {
        if (!heroVariantSrcSet) return false;
        if (src.startsWith('data:') || src.startsWith('blob:')) return false;

        return [
            fallbackImageUrl,
            preferredOriginalImageUrl,
            preloadedHeroImage,
            originalHeroModalSrc,
            preferredBaseHeroUrl,
        ].some((candidate) => candidate === src);
    };
    const getResponsiveAttrsForSrc = (src: string) => shouldUseHeroVariantsForSrc(src)
        ? { srcSet: heroVariantSrcSet, sizes: heroVariantSizes }
        : {};
    const zoomOriginalImage = originalHeroModalSrc || null;
    const zoomCustomizedImage = editedImage || null;
    const zoomInitialTab: ImageTab = activeTab === 'customized' && zoomCustomizedImage ? 'customized' : 'original';
    const activeHeroLoader = isComposingSelfie
        ? {
            label: 'ai is adding your image to the cake',
            text: 'ai adding your image on this cake...',
        }
        : isStudioBackgroundEditingPending
                ? {
                    label: 'ai is editing your background',
                    text: 'ai is editing your background...',
                }
                : null;

    const openHeroImageModal = (src: string) => {
        if (!src) return;
        setIsHeroImageZoomOpen(true);
    };
    const closeHeroImageModal = () => setIsHeroImageZoomOpen(false);
    const centerMobileHeroScrollPosition = () => {
        if (!shouldUseScrollableMobileHero || isHeroImageZoomOpen) return;

        const scrollContainer = mobileHeroScrollRef.current;
        if (!scrollContainer) return;

        const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (maxScrollTop <= 0) {
            scrollContainer.scrollTop = 0;
            return;
        }

        const targetScrollTop = Math.round(maxScrollTop * 0.5);

        if (typeof scrollContainer.scrollTo === 'function') {
            scrollContainer.scrollTo({
                top: targetScrollTop,
                behavior: 'auto',
            });
            return;
        }

        scrollContainer.scrollTop = targetScrollTop;
    };
    const imageOnLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const image = event.currentTarget;
        const loadedSrc = image.currentSrc || image.src;
        const isCustomizedResult = Boolean(
            editedImage
            && activeTab === 'customized'
            && loadedSrc === editedImage
        );

        if (!isCustomizedResult && (!originalImageDimensions || activeTab === 'original')) {
            setOriginalImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
        }
        centerMobileHeroScrollPosition();
    };

    const handleToggleSaveDesign = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        void onToggleSaveDesign();
    };

    const handleUndo = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onUndo();
    };
    const renderScrollableImage = (
        src: string,
        alt: string,
        title: string,
        caption?: string,
        overlaySrc?: string,
        modalSrc?: string,
    ) => {
        const responsiveAttrs = getResponsiveAttrsForSrc(src);

        return (
            <div className="absolute inset-0">
                <div className="relative h-full w-full">
                    <div
                        ref={mobileHeroScrollRef}
                        className="h-full w-full overflow-y-auto overscroll-auto bg-white scroll-smooth"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                        data-testid="mobile-hero-scroll-area"
                    >
                        <div className="relative w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element -- Mobile hero uses a native scrolling image so the frame stays static and the image can be panned inside it. */}
                            <img
                                src={src}
                                {...responsiveAttrs}
                                alt={alt}
                                title={title}
                                // LCP hint: this native <img> is the largest paint
                                // on the customizing PDP. Mark it high priority and
                                // eager so the browser fetches it the instant it's
                                // discovered (and reuses the matching <link rel=preload>).
                                fetchPriority="high"
                                loading="eager"
                                decoding="async"
                                className="block w-full h-auto align-top cursor-zoom-in"
                                onClick={() => openHeroImageModal(modalSrc || overlaySrc || src)}
                                onLoad={imageOnLoad}
                            />
                            {overlaySrc ? (
                                <NativeFadeOverlayImage
                                    key={`scroll-overlay-${overlaySrc}`}
                                    src={overlaySrc}
                                    alt=""
                                    title={title}
                                    className="pointer-events-none absolute inset-x-0 top-0 w-full h-auto align-top"
                                    onLoad={imageOnLoad}
                                />
                            ) : null}
                        </div>
                    </div>
                    <div className="pointer-events-none absolute right-1.5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/28 px-1.5 py-2 text-white shadow-md backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-0.5 text-[8px] font-bold uppercase tracking-[0.18em] leading-none opacity-90">
                            <span aria-hidden="true">↑</span>
                            <span>Scroll</span>
                            <span aria-hidden="true">↓</span>
                        </div>
                    </div>
                    {caption ? (
                        <div className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                            {caption}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderCoveredImage = (
        src: string,
        alt: string,
        title: string,
        caption?: string,
        overlaySrc?: string,
        modalSrc?: string,
    ) => (
        <figure className="absolute inset-0 w-full h-full">
            <LazyImage
                src={src}
                alt={alt}
                title={title}
                fill
                sizes="100vw"
                imageClassName="object-cover rounded-3xl cursor-zoom-in"
                priority
                fetchPriority="high"
                decoding="async"
                unoptimized
                variants={shouldUseHeroVariantsForSrc(src) ? heroImageVariants : null}
                onClick={() => openHeroImageModal(modalSrc || overlaySrc || src)}
                onLoad={imageOnLoad}
            />
            {overlaySrc ? (
                <div className="absolute inset-0 pointer-events-none">
                    <LazyImage
                        key={`cover-overlay-${overlaySrc}`}
                        src={overlaySrc}
                        alt=""
                        title={title}
                        fill
                        sizes="100vw"
                        imageClassName="object-cover rounded-3xl"
                        decoding="async"
                        unoptimized
                        onLoad={imageOnLoad}
                    />
                </div>
            ) : null}
            {caption ? (
                <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                    {caption}
                </figcaption>
            ) : null}
        </figure>
    );

    const renderStaticImage = (
        src: string,
        alt: string,
        title: string,
        caption?: string,
        overlaySrc?: string,
        modalSrc?: string,
    ) => {
        const responsiveAttrs = getResponsiveAttrsForSrc(src);

        return (
            <figure className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- Desktop hero should size naturally to the source image aspect ratio. */}
                <img
                    src={src}
                    {...responsiveAttrs}
                    alt={alt}
                    title={title}
                    // LCP hint: see renderScrollableImage. High priority + eager so
                    // the desktop hero paints without waiting on hydration.
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    className="block w-full h-auto rounded-3xl cursor-zoom-in"
                    onClick={() => openHeroImageModal(modalSrc || overlaySrc || src)}
                    onLoad={imageOnLoad}
                />
                {overlaySrc ? (
                    <NativeFadeOverlayImage
                        key={`static-overlay-${overlaySrc}`}
                        src={overlaySrc}
                        alt=""
                        title={title}
                        className="pointer-events-none absolute inset-x-0 top-0 w-full h-auto rounded-3xl"
                        onLoad={imageOnLoad}
                    />
                ) : null}
                {caption ? (
                    <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                        {caption}
                    </figcaption>
                ) : null}
            </figure>
        );
    };

    return (
        <div className="w-full flex flex-col gap-1">
            <div ref={mainImageContainerRef} className="w-full flex flex-col overflow-hidden rounded-3xl scroll-mt-28 md:scroll-mt-32">
                {isAnalyzing ? (
                    <div className="p-3 w-full text-center animate-fade-in mb-1">
                        <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden">
                            <div className="h-full bg-linear-to-r from-pink-400 via-purple-400 to-indigo-400 progress-bar-fill" />
                        </div>
                        <p className={`text-[10px] text-slate-500 mt-1.5 font-medium tracking-tight transition-opacity duration-300 ${isAnalysisPhraseVisible ? 'opacity-100' : 'opacity-0'}`}>{dynamicAnalysisPhrase}</p>
                    </div>
                ) : null}

                <div className="grow">
                    <div
                        data-testid="customizer-hero-frame"
                        className={enableMobileHeroPan
                            ? 'relative w-full aspect-[5/4] md:min-h-0 rounded-3xl overflow-hidden touch-none md:touch-auto overscroll-auto md:[aspect-ratio:var(--hero-md-ratio)]'
                            : 'relative w-full min-h-[270px] md:min-h-[400px] rounded-3xl overflow-hidden'
                        }
                        onContextMenu={(event) => event.preventDefault()}
                        // Reserve the hero box height before the image loads to
                        // avoid CLS. In pan mode the mobile box is fixed by the
                        // aspect-[5/4] class; desktop (md:aspect-auto) otherwise
                        // had no reserved height and shifted on load, so the
                        // md breakpoint reads the ratio from this CSS var.
                        style={enableMobileHeroPan
                            ? ({ '--hero-md-ratio': heroImageRatio } as React.CSSProperties)
                            : { aspectRatio: heroImageRatio }
                        }
                    >
                        {isCombining ? (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                                <MagicGlitter />
                                <p className="mt-4 text-slate-700 font-bold drop-shadow-sm z-40 relative">Creating your cake design...</p>
                            </div>
                        ) : null}


                        {isUpdatingDesign ? (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                                <MagicGlitter />
                                <p className="mt-4 text-slate-700 font-bold drop-shadow-sm z-40 relative">{dynamicLoadingMessage}</p>
                            </div>
                        ) : null}

                        {error ? (
                            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-20 p-4">
                                <ErrorIcon />
                                <p className={`mt-4 font-semibold ${customerFacingError?.isServiceOutage ? 'text-purple-700' : 'text-red-600'}`}>
                                    {customerFacingError?.title}
                                </p>
                                <p className={`text-sm text-center ${customerFacingError?.isServiceOutage ? 'text-slate-600' : 'text-red-500'}`}>
                                    {customerFacingError?.message}
                                </p>
                            </div>
                        ) : null}

                        {!hasOriginalDisplayImage && !isAnalyzing && !fallbackImageUrl ? (
                            <div className="absolute inset-0 flex items-center justify-center text-center text-slate-400 py-16">
                                <ImageIcon />
                                <p className="mt-2 font-semibold">Your creation will appear here</p>
                            </div>
                        ) : null}

                        {enableMobileHeroPan ? (
                            <>
                                {!hasOriginalDisplayImage && preloadedHeroImage ? (
                                    <>
                                        <div className="md:hidden">
                                            {shouldUseScrollableMobileHero
                                                ? renderScrollableImage(preloadedHeroImage, 'Loading cake design...', 'Loading your cake design', isAnalyzing ? 'Analyzing your design...' : undefined)
                                                : renderCoveredImage(preloadedHeroImage, 'Loading cake design...', 'Loading your cake design', isAnalyzing ? 'Analyzing your design...' : undefined)}
                                        </div>
                                        <div className="hidden md:block">
                                            {renderStaticImage(preloadedHeroImage, 'Loading cake design...', 'Loading your cake design', isAnalyzing ? 'Analyzing your design...' : undefined)}
                                        </div>
                                    </>
                                ) : null}

                                {!hasOriginalDisplayImage && fallbackImageUrl ? (
                                    <>
                                        <div className="md:hidden">
                                            {shouldUseScrollableMobileHero
                                                ? renderScrollableImage(fallbackImageUrl, fallbackImageAlt, fallbackImageTitle, initialCaption || undefined)
                                                : renderCoveredImage(fallbackImageUrl, fallbackImageAlt, fallbackImageTitle, initialCaption || undefined)}
                                        </div>
                                        <div className="hidden md:block">
                                            {renderStaticImage(fallbackImageUrl, fallbackImageAlt, fallbackImageTitle, initialCaption || undefined)}
                                        </div>
                                    </>
                                ) : null}

                                {hasOriginalDisplayImage ? (
                                    <>
                                        <div className="md:hidden">
                                            {shouldUseScrollableMobileHero
                                                ? renderScrollableImage(
                                                    heroDisplaySrc,
                                                    heroImageAlt,
                                                    heroDisplayTitle,
                                                    undefined,
                                                    shouldRenderStudioOverlay ? (incomingStudioImageUrl || undefined) : undefined,
                                                    originalHeroModalSrc,
                                                )
                                                : renderCoveredImage(
                                                    heroDisplaySrc,
                                                    heroImageAlt,
                                                    heroDisplayTitle,
                                                    undefined,
                                                    shouldRenderStudioOverlay ? (incomingStudioImageUrl || undefined) : undefined,
                                                    originalHeroModalSrc,
                                                )}
                                        </div>
                                        <div className="hidden md:block">
                                            {renderStaticImage(
                                                heroDisplaySrc,
                                                heroImageAlt,
                                                heroDisplayTitle,
                                                undefined,
                                                shouldRenderStudioOverlay ? (incomingStudioImageUrl || undefined) : undefined,
                                                originalHeroModalSrc,
                                            )}
                                        </div>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            <>
                                {!hasOriginalDisplayImage && preloadedHeroImage && (
                                    <figure className="absolute inset-0 w-full h-full">
                                        <LazyImage
                                            src={preloadedHeroImage}
                                            alt="Loading cake design..."
                                            title="Loading your cake design"
                                            fill
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                            imageClassName="object-cover rounded-3xl cursor-zoom-in"
                                            priority
                                            fetchPriority="high"
                                            decoding="async"
                                            unoptimized
                                            onClick={() => openHeroImageModal(preloadedHeroImage)}
                                            onLoad={imageOnLoad}
                                        />
                                        {isAnalyzing ? (
                                            <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                                                Analyzing your design...
                                            </figcaption>
                                        ) : null}
                                    </figure>
                                )}

                                {!hasOriginalDisplayImage && fallbackImageUrl && (
                                    <figure className="absolute inset-0 w-full h-full">
                                        <LazyImage
                                            src={fallbackImageUrl}
                                            alt={fallbackImageAlt}
                                            title={fallbackImageTitle}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                            imageClassName="object-cover rounded-3xl cursor-zoom-in"
                                            priority
                                            fetchPriority="high"
                                            decoding="async"
                                            unoptimized
                                            onClick={() => openHeroImageModal(fallbackImageUrl)}
                                            onLoad={imageOnLoad}
                                        />
                                        {initialCaption ? (
                                            <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                                                {initialCaption}
                                            </figcaption>
                                        ) : null}
                                    </figure>
                                )}

                                {hasOriginalDisplayImage ? (
                                    <>
                                        <LazyImage
                                            key={`${activeTab}-${heroDisplaySrc}`}
                                            src={heroDisplaySrc}
                                            alt={heroImageAlt}
                                            title={heroImageTitle}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                            imageClassName="object-cover rounded-3xl cursor-zoom-in"
                                            priority
                                            fetchPriority="high"
                                            decoding="async"
                                            unoptimized
                                            onClick={() => openHeroImageModal(activeTab === 'original' ? originalHeroModalSrc : (editedImage || originalHeroModalSrc))}
                                            onLoad={imageOnLoad}
                                        />

                                        {shouldRenderStudioOverlay && incomingStudioImageUrl ? (
                                            <div className="absolute inset-0 pointer-events-none">
                                                <LazyImage
                                                    key={`incoming-${incomingStudioImageUrl}`}
                                                    src={incomingStudioImageUrl}
                                                    alt={heroImageAlt}
                                                    title={heroImageTitle}
                                                    fill
                                                    sizes="(max-width: 768px) 100vw, 50vw"
                                                    imageClassName="object-cover rounded-3xl"
                                                    decoding="async"
                                                    unoptimized
                                                    onLoad={imageOnLoad}
                                                />
                                            </div>
                                        ) : null}
                                    </>
                                ) : null}
                            </>
                        )}

                        {hasOriginalDisplayImage ? (
                            <>
                                {showSaveDesignButton ? (
                                    <div className="absolute bottom-4 left-4 z-10">
                                        <button
                                            onClick={handleToggleSaveDesign}
                                            className={`backdrop-blur-sm rounded-full text-[10px] max-[360px]:text-[8px] font-semibold transition-all shadow-md px-2.5 py-1 max-[360px]:px-2 max-[360px]:py-0.5 flex items-center gap-1 ${isCurrentDesignSaved ? 'bg-pink-500 text-white hover:bg-pink-600' : 'genie-btn-secondary'}`}
                                            aria-label={isCurrentDesignSaved ? 'Remove from saved' : 'Save this design'}
                                        >
                                            <Heart className="w-3 h-3 max-[360px]:w-2.5 max-[360px]:h-2.5" fill={isCurrentDesignSaved ? 'currentColor' : 'none'} />
                                            {isCurrentDesignSaved ? 'Saved' : 'Save'}
                                        </button>
                                    </div>
                                ) : null}

                                {editedImage ? (
                                    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 p-1 bg-white/85 backdrop-blur-md rounded-full shadow-lg border border-slate-100/60 ring-1 ring-black/5 select-none pointer-events-auto transition-all duration-300 hover:bg-white/95">
                                        <button
                                            type="button"
                                            onClick={onOriginalTabSelect}
                                            className={`px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-full transition-all duration-300 ${
                                                activeTab === 'original'
                                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                                                    : 'text-slate-600 hover:bg-slate-100/60'
                                            }`}
                                        >
                                            Original
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onCustomizedTabSelect}
                                            disabled={!editedImage}
                                            className={`px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-full transition-all duration-300 ${
                                                activeTab === 'customized'
                                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                                                    : 'text-slate-600 hover:bg-slate-100/60 disabled:opacity-40'
                                            }`}
                                        >
                                            Customized
                                        </button>
                                    </div>
                                ) : null}

                                {showPriceGuarantee ? (
                                    <div className="absolute top-3 left-3 z-10 transition-all duration-300">
                                        <div className="bg-green-600/90 backdrop-blur-sm text-white rounded-full px-3 py-1 shadow-md text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold">
                                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                                Guaranteed Price
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                                    {activeHeroLoader ? (
                                        <div
                                            className="flex h-9 px-3.5 items-center gap-2.5 rounded-full bg-white/95 text-purple-600 shadow-lg ring-1 ring-purple-100 backdrop-blur-md transition-all duration-300 animate-pulse pointer-events-none"
                                            aria-label={activeHeroLoader.label}
                                            title={activeHeroLoader.label}
                                        >
                                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-purple-500" />
                                            <span className="text-[8px] font-bold text-slate-800 tracking-wider select-none whitespace-nowrap">
                                                {activeHeroLoader.text}
                                            </span>
                                        </div>
                                    ) : null}

                                    {canUndo ? (
                                        <button
                                            onClick={handleUndo}
                                            disabled={!canUndo || isLoading}
                                            className="genie-btn-primary backdrop-blur-sm rounded-full text-[10px] max-[360px]:text-[8px] font-semibold px-2.5 py-1 max-[360px]:px-2 max-[360px]:py-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                            aria-label="Undo last change"
                                        >
                                            <ResetIcon className="w-2.5 h-2.5 max-[360px]:w-2 max-[360px]:h-2" />
                                            Undo
                                        </button>
                                    ) : null}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            <Link href="/reviews" className="flex items-center justify-center gap-x-1.5 whitespace-nowrap overflow-x-auto px-2 text-center text-[11px] sm:text-sm text-slate-600 hover:text-purple-600 transition-colors duration-200 scrollbar-hide">
                <span className="text-sm sm:text-base font-semibold leading-none text-slate-900">
                    {reviewSummary && reviewSummary.averageRating > 0 ? reviewSummary.averageRating.toFixed(1) : '4.8'}
                </span>
                <span className="flex items-center gap-0.5 shrink-0" aria-label="Rating stars">
                    {Array.from({ length: 5 }, (_, index) => {
                        const starValue = index + 1;
                        const avgRating = reviewSummary?.averageRating || 4.8;
                        const fillClass = starValue <= Math.round(avgRating) ? 'text-amber-400' : 'text-slate-200';
                        return (
                            <span key={index} aria-hidden="true" className={`tracking-tight ${fillClass}`}>
                                ★
                            </span>
                        );
                    })}
                </span>
                <span className="shrink-0">
                    {reviewSummary && reviewSummary.total > 0
                        ? `based on ${reviewSummary.total} Happy Customer${reviewSummary.total === 1 ? '' : 's'}.`
                        : 'based on 6 Happy Customers.'}
                </span>
                {reviewSeparator}
                <span className="inline-flex items-center gap-1 font-semibold text-green-600 shrink-0">
                    Verified <span aria-hidden="true" className="text-green-600">✓</span>
                </span>
            </Link>

            <span className="text-xs font-semibold uppercase tracking-wide text-green-600 text-center">
                FREE Delivery within Cebu City
            </span>

            <ImageZoomModal
                isOpen={isHeroImageZoomOpen}
                onClose={closeHeroImageModal}
                originalImage={zoomOriginalImage}
                customizedImage={zoomCustomizedImage}
                initialTab={zoomInitialTab}
            />

            {showFooterActions ? (
                <div className="hidden md:block animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <HeroActionButtonsRow editedImage={editedImage} isLoading={isLoading} isReporting={isReporting} isSaving={isSaving} onOpenReportModal={onOpenReportModal} onSave={onSave} onClearAll={onClearAll} />
                </div>
            ) : null}
        </div>
    );
});

CustomizingHeroPanel.displayName = 'CustomizingHeroPanel';
