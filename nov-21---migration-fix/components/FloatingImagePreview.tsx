import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { MagicSparkleIcon, Loader2 } from './icons';
import { HybridAnalysisResult } from '../types';
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
  onUpdateDesign: () => void;
  isAnalyzing: boolean;
  analysisResult: HybridAnalysisResult | null;
  isCustomizationDirty: boolean;
}

export const FloatingImagePreview: React.FC<FloatingImagePreviewProps> = React.memo(({
  isVisible,
  originalImage,
  customizedImage,
  isLoading,
  isUpdatingDesign,
  activeTab,
  onTabChange,
  onUpdateDesign,
  isAnalyzing,
  analysisResult,
  isCustomizationDirty,
}) => {
  const show = isVisible && originalImage;

  const handleCustomizedTabClick = () => {
    if (isCustomizationDirty) {
      onUpdateDesign();
    } else {
      onTabChange('customized');
    }
  };

  return (
    <>
      <div
        className={`fixed top-4 left-4 w-[43vw] max-w-xl md:w-[24vw] md:max-w-xs z-30 transition-all duration-300 ease-in-out ${
          show ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        }`}
        aria-hidden={!show}
        role="region"
        aria-label="Floating Image Preview"
      >
        <div className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
          <div className="p-1.5 flex-shrink-0">
            <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
              <button
                onClick={() => onTabChange('original')}
                className={`w-1/2 py-1 text-xs font-semibold rounded-md transition-all duration-200 ease-in-out ${
                  activeTab === 'original'
                    ? 'bg-white shadow text-purple-700'
                    : 'text-slate-600 hover:bg-white/50'
                }`}
              >
                Original
              </button>
              <button
                onClick={handleCustomizedTabClick}
                disabled={(!customizedImage && !isCustomizationDirty) || isUpdatingDesign}
                className={`w-1/2 py-1 text-xs font-semibold rounded-md transition-all duration-200 ease-in-out ${
                  activeTab === 'customized'
                    ? 'bg-white shadow text-purple-700'
                    : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'
                }`}
              >
                Customized
              </button>
            </div>
          </div>
          <div className="relative flex-grow flex items-center justify-center p-2 pt-0 aspect-square">
            {isUpdatingDesign && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20">
                <LoadingSpinner />
              </div>
            )}
            {originalImage && (
              <div
                className="w-full h-full flex items-center justify-center rounded-lg secure-image-container"
                onContextMenu={(e) => e.preventDefault()}
              >
                <LazyImage
                  key={activeTab}
                  src={activeTab === 'customized' ? (customizedImage || originalImage) : originalImage}
                  alt={activeTab === 'customized' && customizedImage ? "Customized Cake" : "Original Cake"}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  placeholderClassName="w-full h-full object-contain rounded-lg"
                />
              </div>
            )}
          </div>
          <div className="p-2 pt-0">
            <button
              onClick={onUpdateDesign}
              disabled={isUpdatingDesign}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center text-xs hidden"
            >
              {isUpdatingDesign ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <MagicSparkleIcon className="w-4 h-4 mr-2" />
                  Update Design
                </>
              )}
            </button>
            {isAnalyzing && (
                <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden mt-2">
                    <div className="absolute h-full w-1/2 bg-gradient-to-r from-pink-500 to-purple-600 animate-progress-slide"></div>
                </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
FloatingImagePreview.displayName = 'FloatingImagePreview';