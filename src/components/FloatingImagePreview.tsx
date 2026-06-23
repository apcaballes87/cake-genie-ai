'use client';
import React, { useState, useEffect, useRef } from 'react';
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
  const [isMinimized, setIsMinimized] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const wasSwiped = useRef(false);

  const show = isVisible && originalImage;
  const showPreview = show && !isModalOpen;
  const currentPreviewImage = activeTab === 'customized' ? (customizedImage || originalImage) : originalImage;
  const displayedAspectRatio = currentPreviewImage ? previewAspectRatio : 1;

  // Reset minimized state when the component is hidden so it starts expanded next time it appears
  useEffect(() => {
    if (!show) {
      setIsMinimized(false);
    }
  }, [show]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentX.current = e.touches[0].clientX;
    wasSwiped.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchCurrentX.current === null) return;

    const deltaX = touchCurrentX.current - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - (touchStartY.current || 0);
    const minSwipeDistance = 30; // threshold in pixels

    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > Math.abs(deltaY)) {
      wasSwiped.current = true;
      if (deltaX > 0 && !isMinimized) {
        setIsMinimized(true);
      } else if (deltaX < 0 && isMinimized) {
        setIsMinimized(false);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchCurrentX.current = null;
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (wasSwiped.current) {
      wasSwiped.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isMinimized) {
      e.preventDefault();
      e.stopPropagation();
      setIsMinimized(false);
    }
  };

  const getTranslateClass = () => {
    if (!showPreview) {
      return 'translate-x-[calc(100%+1rem)] opacity-0 pointer-events-none';
    }
    if (isMinimized) {
      return 'translate-x-[calc(100%-1rem)] opacity-100 cursor-pointer';
    }
    return 'translate-x-0 opacity-100 pointer-events-auto';
  };

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
        className={`fixed top-[30px] right-4 w-[43vw] max-w-[12rem] z-[90] md:hidden transition-all duration-300 ease-in-out flex flex-col gap-2 ${getTranslateClass()}`}
        inert={!showPreview ? true : undefined}
        role="region"
        aria-label="Floating Image Preview"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleContainerClick}
      >
        <div className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col relative overflow-hidden">
          {isMinimized && (
            <div
              className="absolute inset-0 bg-black/5 hover:bg-black/10 transition-colors duration-200 rounded-2xl z-50 cursor-pointer flex items-center justify-start pl-1"
              role="button"
              tabIndex={0}
              aria-label="Restore image preview"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMinimized(false);
                }
              }}
            >
              <svg
                className="w-4 h-4 text-purple-600 animate-pulse"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          )}
          <div
            className="relative grow flex items-center justify-center p-2"
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
        {customizedImage && !isMinimized ? (
          <div className="flex gap-1.5 w-full justify-center px-1">
            <button
              onClick={() => onTabChange('original')}
              className={`flex-1 py-1 text-xs font-semibold rounded-full transition-all duration-200 ease-in-out ${activeTab === 'original'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/80 hover:bg-white text-purple-700 shadow-sm border border-purple-200/50'
                }`}
            >
              Original
            </button>
            <button
              onClick={handleCustomizedTabClick}
              disabled={isUpdatingDesign}
              className={`flex-1 py-1 text-xs font-semibold rounded-full transition-all duration-200 ease-in-out ${activeTab === 'customized'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white/80 hover:bg-white text-purple-700 shadow-sm border border-purple-200/50 disabled:text-slate-400 disabled:hover:bg-white/80 disabled:cursor-not-allowed'
                }`}
            >
              Customized
            </button>
          </div>
        ) : null}
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
