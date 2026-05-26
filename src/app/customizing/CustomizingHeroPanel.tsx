'use client';

import { memo, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import LazyImage from '@/components/LazyImage';
import { ImageZoomModal } from '@/components/ImageZoomModal';
import { Heart, ShieldCheck, Wand2 } from 'lucide-react';
import { ErrorIcon, ImageIcon, ResetIcon, SaveIcon, Loader2, ReportIcon } from '../../components/icons';
import MagicGlitter from '@/components/MagicGlitter';
import { THEME_COLORS } from './CustomizingStepSummarySections';


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
    colorVariants?: Record<string, string> | null; // ADDED
    onSelectColorVariant?: (hex: string, imageUrl: string) => void; // ADDED
    reviewSummary?: {
        total: number;
        averageRating: number;
    } | null;
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
    colorVariants = null, // ADDED
    onSelectColorVariant, // ADDED
}: CustomizingHeroPanelProps) => {
    const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [isHeroImageZoomOpen, setIsHeroImageZoomOpen] = useState(false);
    const mobileHeroScrollRef = useRef<HTMLDivElement | null>(null);
    const heroDisplaySrc = activeTab === 'customized'
        ? (editedImage || originalImagePreview || preloadedHeroImage || fallbackImageUrl || '')
        : (originalImagePreview || preloadedHeroImage || fallbackImageUrl || '');
    const heroDisplayTitle = heroImageTitle;
    const heroImageRatio = originalImageDimensions ? `${originalImageDimensions.width} / ${originalImageDimensions.height}` : '1 / 1';
    const zoomOriginalImage = originalImagePreview || preloadedHeroImage || fallbackImageUrl || null;
    const zoomCustomizedImage = editedImage || null;
    const zoomInitialTab: ImageTab = activeTab === 'customized' && zoomCustomizedImage ? 'customized' : 'original';
    const openHeroImageModal = (src: string) => {
        if (!src) return;
        setIsHeroImageZoomOpen(true);
    };
    const closeHeroImageModal = () => setIsHeroImageZoomOpen(false);
    const centerMobileHeroScrollPosition = () => {
        if (!enableMobileHeroPan || isHeroImageZoomOpen) return;

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
        if (!originalImageDimensions || activeTab === 'original') {
            setOriginalImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
        }
        centerMobileHeroScrollPosition();
    };

    const renderScrollableImage = (src: string, alt: string, title: string, caption?: string) => (
        <div className="absolute inset-0">
            <div className="relative h-full w-full">
                <div
                    ref={mobileHeroScrollRef}
                    className="h-full w-full overflow-y-auto overscroll-auto bg-white scroll-smooth"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                    data-testid="mobile-hero-scroll-area"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Mobile hero uses a native scrolling image so the frame stays static and the image can be panned inside it. */}
                    <img
                        src={src}
                        alt={alt}
                        title={title}
                        className="block w-full h-auto align-top cursor-zoom-in"
                        onClick={() => openHeroImageModal(src)}
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

    const renderStaticImage = (src: string, alt: string, title: string, caption?: string) => (
        <figure className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- Desktop hero should size naturally to the source image aspect ratio. */}
            <img
                src={src}
                alt={alt}
                title={title}
                className="block w-full h-auto rounded-3xl cursor-zoom-in"
                onClick={() => openHeroImageModal(src)}
                onLoad={imageOnLoad}
            />
            {caption ? (
                <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                    {caption}
                </figcaption>
            ) : null}
        </figure>
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
                            ? 'relative w-full aspect-[5/4] md:aspect-auto md:min-h-0 rounded-3xl overflow-hidden touch-none md:touch-auto overscroll-auto'
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
                                    <>
                                        <div className="md:hidden">
                                            {renderScrollableImage(preloadedHeroImage, 'Loading cake design...', 'Loading your cake design', isAnalyzing ? 'Analyzing your design...' : undefined)}
                                        </div>
                                        <div className="hidden md:block">
                                            {renderStaticImage(preloadedHeroImage, 'Loading cake design...', 'Loading your cake design', isAnalyzing ? 'Analyzing your design...' : undefined)}
                                        </div>
                                    </>
                                ) : null}

                                {!originalImagePreview && fallbackImageUrl ? (
                                    <>
                                        <div className="md:hidden">
                                            {renderScrollableImage(fallbackImageUrl, fallbackImageAlt, fallbackImageTitle, initialCaption || undefined)}
                                        </div>
                                        <div className="hidden md:block">
                                            {renderStaticImage(fallbackImageUrl, fallbackImageAlt, fallbackImageTitle, initialCaption || undefined)}
                                        </div>
                                    </>
                                ) : null}

                                {originalImagePreview ? (
                                    <>
                                        <div className="md:hidden">
                                            {renderScrollableImage(
                                                heroDisplaySrc,
                                                heroImageAlt,
                                                heroDisplayTitle,
                                                undefined,
                                            )}
                                        </div>
                                        <div className="hidden md:block">
                                            {renderStaticImage(
                                                heroDisplaySrc,
                                                heroImageAlt,
                                                heroDisplayTitle,
                                                undefined,
                                            )}
                                        </div>
                                    </>
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
                                        onClick={() => openHeroImageModal(activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview)}
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

                                {showMotifButton ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onOpenMotifPanel?.();
                                        }}
                                        className="absolute bottom-3 left-3 z-10 md:hidden bg-black/40 backdrop-blur-sm text-white rounded-full text-xs font-semibold hover:bg-black/60 transition-all shadow-md px-3 py-1.5 flex items-center gap-1.5"
                                        aria-label="Change Motif Color"
                                    >
                                        <Wand2 className="w-4 h-4" />
                                        Motif
                                    </button>
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

            {/* Color Variant Thumbnails (only show if there's at least one variant generated) */}
            {colorVariants && Object.keys(colorVariants).length > 0 ? (
                <div className="w-full mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-start gap-2 overflow-x-auto py-1 px-2 scrollbar-hide">
                        {/* Original Image Option */}
                        <button
                            type="button"
                            onClick={() => onOriginalTabSelect()}
                            className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
                                activeTab === 'original'
                                    ? 'border-purple-600 ring-2 ring-purple-100 scale-105 shadow-sm'
                                    : 'border-slate-200 hover:border-purple-300 hover:scale-105'
                            }`}
                            aria-label="Original cake design"
                        >
                            <LazyImage
                                src={originalImagePreview || preloadedHeroImage || fallbackImageUrl || ''}
                                alt="Original variant"
                                fill
                                sizes="48px"
                                imageClassName="object-contain bg-slate-50"
                            />
                        </button>

                        {/* Theme Color Variants */}
                        {Object.entries(colorVariants).map(([hex, imageUrl]) => {
                            const isSelected = activeTab === 'customized' && editedImage === imageUrl;
                            
                            // Find color name
                            const colorName = THEME_COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase())?.name || 'custom';
                            
                            return (
                                <button
                                    key={hex}
                                    type="button"
                                    onClick={() => onSelectColorVariant?.(hex, imageUrl)}
                                    className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
                                        isSelected
                                            ? 'border-purple-600 ring-2 ring-purple-100 scale-105 shadow-sm'
                                            : 'border-slate-200 hover:border-purple-300 hover:scale-105'
                                    }`}
                                    title={`${colorName} variant`}
                                    aria-label={`${colorName} cake variant`}
                                >
                                    <LazyImage
                                        src={imageUrl}
                                        alt={`${colorName} variant`}
                                        fill
                                        sizes="48px"
                                        imageClassName="object-contain bg-slate-50"
                                    />
                                    {/* Small badge to show the color circle at the bottom right */}
                                    <div
                                        className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white shadow-xs"
                                        style={{ backgroundColor: hex }}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}

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
