'use client';

import { memo, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import LazyImage from '@/components/LazyImage';
import { Heart, ShieldCheck } from 'lucide-react';
import { CloseIcon, ErrorIcon, ImageIcon, ResetIcon, SaveIcon, Loader2, ReportIcon } from '../../components/icons';
import MagicGlitter from '@/components/MagicGlitter';


type ImageTab = 'original' | 'customized';

interface CustomizingHeroPanelProps {
    mainImageContainerRef: RefObject<HTMLDivElement | null>;
    editedImage: string | null;
    activeTab: ImageTab;
    isAnalyzing: boolean;
    isUpdatingDesign: boolean;
    dynamicLoadingMessage: string;
    error: string | null;
    originalImagePreview: string | null;
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
    isCombining?: boolean;
    enableMobileHeroPan?: boolean;
    onOriginalTabSelect: () => void;
    onCustomizedTabSelect: () => void;
    onToggleSaveDesign: () => void | Promise<void>;
    onUndo: () => void;
    onOpenReportModal: () => void;
    onSave: () => void;
    onClearAll: () => void;
}

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

export const CustomizingHeroPanel = memo(({
    mainImageContainerRef,
    editedImage,
    activeTab,
    isAnalyzing,
    isUpdatingDesign,
    dynamicLoadingMessage,
    error,
    originalImagePreview,
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
    isCombining,
    enableMobileHeroPan = false,
    onOriginalTabSelect,
    onCustomizedTabSelect,
    onToggleSaveDesign,
    onUndo,
    onOpenReportModal,
    onSave,
    onClearAll,
}: CustomizingHeroPanelProps) => {
    const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [heroImageModal, setHeroImageModal] = useState<{ src: string; alt: string; title: string } | null>(null);
    const mobileHeroScrollRef = useRef<HTMLDivElement | null>(null);
    const mobileHeroIntroPlayedRef = useRef(false);
    const heroDisplaySrc = activeTab === 'customized'
        ? (editedImage || originalImagePreview || preloadedHeroImage || fallbackImageUrl || '')
        : (originalImagePreview || preloadedHeroImage || fallbackImageUrl || '');
    const heroDisplayTitle = heroImageTitle;
    const heroImageRatio = originalImageDimensions ? `${originalImageDimensions.width} / ${originalImageDimensions.height}` : '1 / 1';
    const mobileHeroIntroStorageKey = 'genie:customizing-hero-autoscroll-v1';
    const openHeroImageModal = (src: string, alt: string, title: string) => {
        if (!src) return;
        setHeroImageModal({ src, alt, title });
    };
    const closeHeroImageModal = () => setHeroImageModal(null);
    const imageOnLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const image = event.currentTarget;
        if (!originalImageDimensions || activeTab === 'original') {
            setOriginalImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
        }
    };

    useEffect(() => {
        if (!heroImageModal) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [heroImageModal]);

    useEffect(() => {
        if (!enableMobileHeroPan || heroImageModal) return;
        if (typeof window === 'undefined') return;

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
        if (prefersReducedMotion) return;

        if (mobileHeroIntroPlayedRef.current) return;

        try {
            if (window.localStorage.getItem(mobileHeroIntroStorageKey) === '1') {
                mobileHeroIntroPlayedRef.current = true;
                return;
            }
        } catch {
            // Ignore storage access issues and fall back to in-memory tracking.
        }

        const scrollContainer = mobileHeroScrollRef.current;
        if (!scrollContainer) return;

        const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (maxScrollTop <= 0) return;

        mobileHeroIntroPlayedRef.current = true;

        try {
            window.localStorage.setItem(mobileHeroIntroStorageKey, '1');
        } catch {
            // Ignore storage write failures.
        }

        scrollContainer.scrollTop = 0;

        const timer = window.setTimeout(() => {
            scrollContainer.scrollTo({
                top: Math.round(maxScrollTop * 0.5),
                behavior: 'smooth',
            });
        }, 450);

        return () => window.clearTimeout(timer);
    }, [enableMobileHeroPan, heroDisplaySrc, heroImageModal, mobileHeroIntroStorageKey]);

    useEffect(() => {
        if (!heroImageModal) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeHeroImageModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [heroImageModal]);

    const renderScrollableImage = (src: string, alt: string, title: string, caption?: string) => (
        <div className="absolute inset-0">
            <div className="relative h-full w-full">
                <div
                    ref={mobileHeroScrollRef}
                    className="h-full w-full overflow-y-auto overscroll-contain bg-white scroll-smooth"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                    data-testid="mobile-hero-scroll-area"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Mobile hero uses a native scrolling image so the frame stays static and the image can be panned inside it. */}
                    <img
                        src={src}
                        alt={alt}
                        title={title}
                        className="block w-full h-auto align-top cursor-zoom-in"
                        onClick={() => openHeroImageModal(src, alt, title)}
                        onLoad={imageOnLoad}
                    />
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

    return (
        <div className="w-full flex flex-col gap-1">
            {/* Tabs above the image container */}
            {editedImage ? (
                <div className="flex w-full gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
                    <button
                        onClick={onOriginalTabSelect}
                        className={`flex-1 py-2 text-xs font-bold rounded-full border transition-all shadow-sm ${activeTab === 'original' ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        Original
                    </button>
                    <button
                        onClick={onCustomizedTabSelect}
                        disabled={!editedImage}
                        className={`flex-1 py-2 text-xs font-bold rounded-full border transition-all shadow-sm ${activeTab === 'customized' ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50'}`}
                    >
                        Customized
                    </button>
                </div>
            ) : null}

            <div ref={mainImageContainerRef} className="w-full flex flex-col overflow-hidden rounded-3xl scroll-mt-28 md:scroll-mt-32">
                {isAnalyzing ? (
                    <div className="p-3 w-full text-center animate-fade-in mb-1">
                        <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden">
                            <div className="h-full bg-linear-to-r from-pink-400 via-purple-400 to-indigo-400 progress-bar-fill" />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium tracking-tight">Analyzing design elements & pricing...</p>
                    </div>
                ) : null}

                <div className="grow">
                    <div
                        className={enableMobileHeroPan
                            ? 'relative w-full aspect-[5/4] md:aspect-[2/3] md:min-h-[400px] rounded-3xl overflow-hidden touch-none md:touch-auto overscroll-contain'
                            : 'relative w-full min-h-[270px] md:min-h-[400px] rounded-3xl overflow-hidden'
                        }
                        onContextMenu={(event) => event.preventDefault()}
                        style={enableMobileHeroPan ? undefined : { aspectRatio: heroImageRatio }}
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
                                <p className="mt-4 font-semibold text-red-600">{error.startsWith('AI_REJECTION:') ? 'Image Rejected' : 'Update Failed'}</p>
                                <p className="text-sm text-red-500 text-center">{error.replace('AI_REJECTION: ', '')}</p>
                            </div>
                        ) : null}

                        {!originalImagePreview && !isAnalyzing && !fallbackImageUrl ? (
                            <div className="absolute inset-0 flex items-center justify-center text-center text-slate-400 py-16">
                                <ImageIcon />
                                <p className="mt-2 font-semibold">Your creation will appear here</p>
                            </div>
                        ) : null}

                        {enableMobileHeroPan ? (
                            <>
                                {!originalImagePreview && preloadedHeroImage ? (
                                    renderScrollableImage(preloadedHeroImage, 'Loading cake design...', 'Loading your cake design', isAnalyzing ? 'Analyzing your design...' : undefined)
                                ) : null}

                                {!originalImagePreview && fallbackImageUrl ? (
                                    renderScrollableImage(fallbackImageUrl, fallbackImageAlt, fallbackImageTitle, initialCaption || undefined)
                                ) : null}

                                {originalImagePreview ? (
                                    renderScrollableImage(
                                        heroDisplaySrc,
                                        heroImageAlt,
                                        heroDisplayTitle,
                                        undefined,
                                    )
                                ) : null}
                            </>
                        ) : (
                            <>
                                {!originalImagePreview && preloadedHeroImage && (
                                    <figure className="absolute inset-0 w-full h-full">
                                        <LazyImage
                                            src={preloadedHeroImage}
                                            alt="Loading cake design..."
                                            title="Loading your cake design"
                                            fill
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                            imageClassName="object-contain rounded-3xl cursor-zoom-in"
                                            priority
                                            fetchPriority="high"
                                            decoding="async"
                                            unoptimized
                                            onClick={() => openHeroImageModal(preloadedHeroImage, 'Loading cake design...', 'Loading your cake design')}
                                            onLoad={imageOnLoad}
                                        />
                                        {isAnalyzing ? (
                                            <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                                                Analyzing your design...
                                            </figcaption>
                                        ) : null}
                                    </figure>
                                )}

                                {!originalImagePreview && fallbackImageUrl && (
                                    <figure className="absolute inset-0 w-full h-full">
                                        <LazyImage
                                            src={fallbackImageUrl}
                                            alt={fallbackImageAlt}
                                            title={fallbackImageTitle}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                            imageClassName="object-contain rounded-3xl cursor-zoom-in"
                                            priority
                                            fetchPriority="high"
                                            decoding="async"
                                            unoptimized
                                            onClick={() => openHeroImageModal(fallbackImageUrl, fallbackImageAlt, fallbackImageTitle)}
                                            onLoad={imageOnLoad}
                                        />
                                        {initialCaption ? (
                                            <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                                                {initialCaption}
                                            </figcaption>
                                        ) : null}
                                    </figure>
                                )}

                                {originalImagePreview ? (
                                    <LazyImage
                                        key={activeTab}
                                        src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview}
                                        alt={heroImageAlt}
                                        title={heroImageTitle}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        imageClassName="object-contain rounded-3xl cursor-zoom-in"
                                        priority
                                        fetchPriority="high"
                                        decoding="async"
                                        unoptimized
                                        onClick={() => openHeroImageModal(activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview, heroImageAlt, heroImageTitle)}
                                        onLoad={(event) => {
                                            const image = event.currentTarget;
                                            if (!originalImageDimensions || activeTab === 'original') {
                                                setOriginalImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
                                            }
                                        }}
                                    />
                                ) : null}
                            </>
                        )}

                        {originalImagePreview ? (
                            <>
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

                                <div className="absolute top-3 right-3 z-10 flex gap-2">
                                    {showSaveDesignButton ? (
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void onToggleSaveDesign();
                                            }}
                                            className={`backdrop-blur-sm rounded-full text-[10px] max-[360px]:text-[8px] font-semibold transition-all shadow-md px-2.5 py-1 max-[360px]:px-2 max-[360px]:py-0.5 flex items-center gap-1 ${isCurrentDesignSaved ? 'bg-pink-500 text-white hover:bg-pink-600' : 'genie-btn-secondary'}`}
                                            aria-label={isCurrentDesignSaved ? 'Remove from saved' : 'Save this design'}
                                        >
                                            <Heart className="w-3 h-3 max-[360px]:w-2.5 max-[360px]:h-2.5" fill={isCurrentDesignSaved ? 'currentColor' : 'none'} />
                                            {isCurrentDesignSaved ? 'Saved' : 'Save'}
                                        </button>
                                    ) : null}

                                    {canUndo ? (
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onUndo();
                                            }}
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

            <div className="flex items-center justify-center gap-x-1.5 whitespace-nowrap overflow-x-auto px-2 text-center text-[11px] sm:text-sm text-slate-600 scrollbar-hide">
                <span className="text-sm sm:text-base font-semibold leading-none text-slate-900">4.8</span>
                <span className="flex items-center gap-0.5 shrink-0" aria-label="5 star rating">
                        {reviewStars}
                </span>
                <span className="shrink-0">based on 6 Happy Customers.</span>
                {reviewSeparator}
                <span className="inline-flex items-center gap-1 font-semibold text-green-600 shrink-0">
                    Verified <span aria-hidden="true" className="text-green-600">✓</span>
                </span>
            </div>

            <span className="text-xs font-semibold uppercase tracking-wide text-green-600 text-center">
                FREE Delivery within Cebu City
            </span>

            {heroImageModal ? (
                <div
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Full screen image preview"
                    onClick={closeHeroImageModal}
                    onContextMenu={(event) => event.preventDefault()}
                >
                    <div
                        className="relative w-full max-w-[88vw] h-[72vh] sm:max-w-[72vw] sm:h-[72vh] lg:max-w-[56vw] lg:h-[68vh]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={closeHeroImageModal}
                            className="absolute top-3 right-3 z-20 rounded-full bg-black/45 text-white p-2 backdrop-blur-md shadow-lg hover:bg-black/60 transition-colors"
                            aria-label="Close image preview"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>

                        <LazyImage
                            src={heroImageModal.src}
                            alt={heroImageModal.alt}
                            title={heroImageModal.title}
                            fill
                            sizes="(max-width: 640px) 88vw, (max-width: 1024px) 72vw, 56vw"
                            imageClassName="object-contain rounded-2xl"
                            priority
                            fetchPriority="high"
                            decoding="async"
                            unoptimized
                        />
                    </div>
                </div>
            ) : null}

            {showFooterActions ? (
                <div className="hidden md:block animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <HeroActionButtonsRow editedImage={editedImage} isLoading={isLoading} isReporting={isReporting} isSaving={isSaving} onOpenReportModal={onOpenReportModal} onSave={onSave} onClearAll={onClearAll} />
                </div>
            ) : null}
        </div>
    );
});

CustomizingHeroPanel.displayName = 'CustomizingHeroPanel';
