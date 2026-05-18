'use client';
import React, { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { HybridAnalysisResult } from '@/types';
import { ImageZoomModal } from './ImageZoomModal';
import LazyImage from './LazyImage';

type ImageTab = 'original' | 'customized';

interface FloatingImagePreviewProps {
  isVisible: boolean;
  originalImage: string | null;
  customizedImage: string | null;
  isLoading: boolean;
  isUpdatingDesign: boolean;
  activeTab: ImageTab;
  onTabChange: (tab: ImageTab) => void;
  isAnalyzing: boolean;
  analysisResult: HybridAnalysisResult | null;
  isCustomizationDirty: boolean;
  onUpdateDesign?: () => void;
}

export const FloatingImagePreview: React.FC<FloatingImagePreviewProps> = React.memo(({
  isVisible,
  originalImage,
  customizedImage,
  isLoading,
  isUpdatingDesign,
  activeTab,
  onTabChange,
  isAnalyzing,
  analysisResult,
  isCustomizationDirty,
  onUpdateDesign,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(1);
  const show = isVisible && originalImage;
  const showPreview = show && !isModalOpen;
  const currentPreviewImage = activeTab === 'customized' ? (customizedImage || originalImage) : originalImage;
  const displayedAspectRatio = currentPreviewImage ? previewAspectRatio : 1;

  const handleCustomizedTabClick = () => {
    if (isCustomizationDirty) {
      onUpdateDesign?.();
    } else {
      onTabChange('customized');
    }
  };

  const handlePreviewImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      return;
    }

    const rawRatio = naturalWidth / naturalHeight;
    const clampedRatio = Math.min(1, Math.max(0.75, rawRatio));
    setPreviewAspectRatio(clampedRatio);
  };

  return (
    <>
      <div
        className={`fixed top-20 right-4 w-[43vw] max-w-[12rem] z-[90] md:hidden transition-all duration-300 ease-in-out ${showPreview ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-[calc(100%+1rem)] opacity-0 pointer-events-none'
          }`}
        inert={!showPreview ? true : undefined}
        role="region"
        aria-label="Floating Image Preview"
      >
        <div className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
          {customizedImage ? (
            <div className="p-1.5 shrink-0 flex gap-1">
              <button
                onClick={() => onTabChange('original')}
                className={`flex-1 py-1 text-xs font-semibold rounded-full transition-all duration-200 ease-in-out ${activeTab === 'original'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-white text-purple-700 shadow-sm hover:bg-white/90'
                  }`}
              >
                Original
              </button>
              <button
                onClick={handleCustomizedTabClick}
                disabled={isUpdatingDesign}
                className={`flex-1 py-1 text-xs font-semibold rounded-full transition-all duration-200 ease-in-out ${activeTab === 'customized'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-white text-purple-700 shadow-sm hover:bg-white/90 disabled:text-slate-400 disabled:hover:bg-white disabled:cursor-not-allowed'
                  }`}
              >
                Customized
              </button>
            </div>
          ) : null}
          <div
            className="relative grow flex items-center justify-center p-2 pt-0"
            data-testid="floating-image-frame"
            style={{ aspectRatio: String(displayedAspectRatio) }}
          >
            {isUpdatingDesign && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20">
                <LoadingSpinner />
              </div>
            )}
            {currentPreviewImage && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full h-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-lg secure-image-container"
                aria-label="Enlarge image"
                onContextMenu={(e) => e.preventDefault()}
              >
                <LazyImage
                  key={activeTab}
                  src={currentPreviewImage}
                  alt={activeTab === 'customized' && customizedImage ? "Customized Cake" : "Original Cake"}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  placeholderClassName="w-full h-full object-contain rounded-lg"
                  priority
                  onLoad={handlePreviewImageLoad}
                />
              </button>
            )}
          </div>
          {isAnalyzing ? (
            <div className="p-2 pt-0">
              <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden mt-2">
                <div className="absolute h-full w-1/2 bg-linear-to-r from-pink-500 to-purple-600 animate-progress-slide"></div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <ImageZoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        originalImage={originalImage}
        customizedImage={customizedImage}
        initialTab={activeTab}
      />
    </>
  );
});
FloatingImagePreview.displayName = 'FloatingImagePreview';
