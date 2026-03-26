'use client';

import { memo, useRef, useState, type RefObject } from 'react';
import LazyImage from '@/components/LazyImage';
import { Heart, ShieldCheck } from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorIcon, ImageIcon, ResetIcon, SaveIcon, Loader2, ReportIcon } from '../../components/icons';

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
    onOriginalTabSelect: () => void;
    onCustomizedTabSelect: () => void;
    onToggleSaveDesign: () => void | Promise<void>;
    onUndo: () => void;
    onOpenReportModal: () => void;
    onSave: () => void;
    onClearAll: () => void;
}

interface HeroActionButtonsRowProps {
    editedImage: string | null;
    isLoading: boolean;
    isReporting: boolean;
    isSaving: boolean;
    isCompact?: boolean;
    onOpenReportModal: () => void;
    onSave: () => void;
    onClearAll: () => void;
}

function HeroActionButtonsRow({ editedImage, isLoading, isReporting, isSaving, isCompact = false, onOpenReportModal, onSave, onClearAll }: HeroActionButtonsRowProps) {
    const containerClassName = isCompact
        ? 'w-full flex items-center justify-center flex-nowrap gap-1.5 p-2 border-t border-slate-100 overflow-hidden'
        : 'w-full flex items-center justify-end gap-1.5 pt-3 px-1.5 pb-2 mt-auto border-t border-slate-100 flex-nowrap overflow-hidden';
    const buttonClassName = isCompact
        ? 'flex items-center justify-center text-[10px] max-[340px]:text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-1.5 px-2 max-[340px]:px-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink'
        : 'flex items-center justify-center text-[10px] max-[340px]:text-[9px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 py-1.5 px-2 max-[340px]:px-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink';
    const iconClassName = isCompact ? 'w-3.5 h-3.5' : 'w-3 h-3';

    return (
        <div className={containerClassName}>
            <button onClick={onOpenReportModal} disabled={!editedImage || isLoading || isReporting} className={buttonClassName} aria-label="Report an issue with this image">
                <ReportIcon className={`${iconClassName} shrink-0`} />
                <span className="ml-1 shrink overflow-hidden text-ellipsis">{isReporting ? 'Submitting...' : 'Report Issue'}</span>
            </button>

            <button onClick={onSave} disabled={!editedImage || isLoading || isSaving} className={buttonClassName} aria-label={isSaving ? 'Saving image' : 'Save customized image'}>
                {isSaving ? (
                    <>
                        <Loader2 className={`${iconClassName} animate-spin shrink-0`} />
                        <span className="ml-1 shrink overflow-hidden text-ellipsis">Saving...</span>
                    </>
                ) : (
                    <>
                        <SaveIcon className={`${iconClassName} shrink-0`} />
                        <span className="ml-1 shrink overflow-hidden text-ellipsis">Save</span>
                    </>
                )}
            </button>

            <button onClick={onClearAll} className={buttonClassName.replace('disabled:opacity-50 disabled:cursor-not-allowed ', '')} aria-label="Reset everything">
                <ResetIcon className={`${iconClassName} shrink-0`} />
                <span className="ml-1 shrink overflow-hidden text-ellipsis">Reset Everything</span>
            </button>
        </div>
    );
}

export const CustomizingHeroPanel = memo(function CustomizingHeroPanel({
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
    onOriginalTabSelect,
    onCustomizedTabSelect,
    onToggleSaveDesign,
    onUndo,
    onOpenReportModal,
    onSave,
    onClearAll,
}: CustomizingHeroPanelProps) {
    const markerContainerRef = useRef<HTMLDivElement>(null);
    const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);

    return (
        <div ref={mainImageContainerRef} className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
            <div className="p-2 shrink-0">
                {editedImage ? (
                    <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                        <button onClick={onOriginalTabSelect} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'}`}>Original</button>
                        <button onClick={onCustomizedTabSelect} disabled={!editedImage} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'}`}>Customized</button>
                    </div>
                ) : null}

                {isAnalyzing ? (
                    <div className="mt-3 w-full text-center animate-fade-in">
                        <div className="w-full bg-slate-200 rounded-full h-2.5 relative overflow-hidden">
                            <div className="h-full bg-linear-to-r from-pink-500 to-purple-600 progress-bar-fill" />
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-medium">Analyzing design elements & pricing... You can start customizing below.</p>
                    </div>
                ) : null}
            </div>

            <div className="p-2 pt-0 grow">
                <div
                    ref={markerContainerRef}
                    className="relative w-full min-h-[300px] md:min-h-[400px] bg-slate-50/50 rounded-2xl overflow-hidden"
                    onContextMenu={(event) => event.preventDefault()}
                    style={{ aspectRatio: originalImageDimensions ? `${originalImageDimensions.width} / ${originalImageDimensions.height}` : '1 / 1' }}
                >
                    {isUpdatingDesign ? (
                        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-2xl z-20">
                            <LoadingSpinner />
                            <p className="mt-4 text-slate-500 font-semibold">{dynamicLoadingMessage}</p>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20 p-4">
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

                    {!originalImagePreview && preloadedHeroImage && (
                        <figure className="absolute inset-0 w-full h-full">
                            <LazyImage src={preloadedHeroImage} alt="Loading cake design..." title="Loading your cake design" fill sizes="(max-width: 768px) 100vw, 50vw" imageClassName="object-contain rounded-lg" priority fetchPriority="high" decoding="async" unoptimized />
                            {isAnalyzing ? (
                                <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                                    Analyzing your design...
                                </figcaption>
                            ) : null}
                        </figure>
                    )}

                    {!originalImagePreview && fallbackImageUrl && (
                        <figure className="absolute inset-0 w-full h-full">
                            <LazyImage src={fallbackImageUrl} alt={fallbackImageAlt} title={fallbackImageTitle} fill sizes="(max-width: 768px) 100vw, 50vw" imageClassName="object-contain rounded-lg" priority fetchPriority="high" decoding="async" unoptimized />
                            {initialCaption ? (
                                <figcaption className="absolute bottom-0 left-0 right-0 text-[10px] text-slate-500 p-2 text-center bg-white/60 backdrop-blur-sm z-10 leading-tight">
                                    {initialCaption}
                                </figcaption>
                            ) : null}
                        </figure>
                    )}

                    {originalImagePreview ? (
                        <>
                            <LazyImage
                                key={activeTab}
                                src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview}
                                alt={heroImageAlt}
                                title={heroImageTitle}
                                fill
                                sizes="(max-width: 768px) 100vw, 50vw"
                                imageClassName="object-contain rounded-lg"
                                priority
                                fetchPriority="high"
                                decoding="async"
                                unoptimized
                                onLoad={(event) => {
                                    const image = event.currentTarget;
                                    if (!originalImageDimensions || activeTab === 'original') {
                                        setOriginalImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
                                    }
                                }}
                            />

                            {showPriceGuarantee ? (
                                <div className="absolute bottom-3 left-3 z-20 transition-all duration-300">
                                    <div className="bg-green-600/90 backdrop-blur-sm text-white rounded-full px-3 py-1 shadow-md text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1 text-[11px] font-semibold">
                                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                            Guaranteed Price
                                        </div>
                                        <p className="text-[8px] text-green-100 font-medium tracking-tight">Based on real cakeshop data</p>
                                    </div>
                                </div>
                            ) : null}

                            {showSaveDesignButton ? (
                                <div className="absolute top-3 left-3 z-10">
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            void onToggleSaveDesign();
                                        }}
                                        className={`backdrop-blur-sm rounded-full text-[10px] max-[360px]:text-[8px] font-semibold transition-all shadow-md px-2.5 py-1 max-[360px]:px-2 max-[360px]:py-0.5 flex items-center gap-1 ${isCurrentDesignSaved ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white/90 text-slate-700 hover:bg-red-50 hover:text-red-500'}`}
                                        aria-label={isCurrentDesignSaved ? 'Remove from saved' : 'Save this design'}
                                    >
                                        <Heart className="w-3 h-3 max-[360px]:w-2.5 max-[360px]:h-2.5" fill={isCurrentDesignSaved ? 'currentColor' : 'none'} />
                                        {isCurrentDesignSaved ? 'Saved' : 'Save'}
                                    </button>
                                </div>
                            ) : null}

                            {canUndo ? (
                                <div className="absolute top-3 right-3 z-10 flex gap-2">
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onUndo();
                                        }}
                                        disabled={!canUndo || isLoading}
                                        className="bg-orange-500/90 backdrop-blur-sm text-white rounded-full text-[10px] max-[360px]:text-[8px] font-semibold hover:bg-orange-600 transition-all shadow-md px-2.5 py-1 max-[360px]:px-2 max-[360px]:py-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        aria-label="Undo last change"
                                    >
                                        <ResetIcon className="w-2.5 h-2.5 max-[360px]:w-2 max-[360px]:h-2" />
                                        Undo
                                    </button>
                                </div>
                            ) : null}
                        </>
                    ) : null}

                </div>
            </div>

            {showFooterActions ? (
                <HeroActionButtonsRow editedImage={editedImage} isLoading={isLoading} isReporting={isReporting} isSaving={isSaving} isCompact onOpenReportModal={onOpenReportModal} onSave={onSave} onClearAll={onClearAll} />
            ) : null}
        </div>
    );
});

CustomizingHeroPanel.displayName = 'CustomizingHeroPanel';