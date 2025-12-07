'use client';
import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons';
import LazyImage from './LazyImage';

type ImageTab = 'original' | 'customized';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: string | null;
  customizedImage: string | null;
  initialTab?: ImageTab;
}

export const ImageZoomModal = React.memo<ImageZoomModalProps>(({
  isOpen,
  onClose,
  originalImage,
  customizedImage,
  initialTab = 'original',
}) => {
  const [activeTab, setActiveTab] = useState<ImageTab>(initialTab);

  useEffect(() => {
    // Reset to initialTab whenever the modal is opened
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !originalImage) {
    return null;
  }

  const currentImage = activeTab === 'customized' ? (customizedImage || originalImage) : originalImage;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 transition-opacity duration-200 animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <style>{`.animate-fadeIn { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors z-20"
        aria-label="Close zoomed image"
      >
        <CloseIcon />
      </button>

      <div
        className="relative w-full h-full flex items-center justify-center secure-image-container"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <LazyImage
          key={activeTab} // To force re-render with animation on tab change
          src={currentImage}
          alt={`${activeTab} cake preview`}
          className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl animate-fadeIn"
          placeholderClassName="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
        />
      </div>

      <div className="absolute bottom-6 z-20" onClick={(e) => e.stopPropagation()}>
        <div className="bg-black/40 p-1.5 rounded-full flex space-x-2 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('original')}
            className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === 'original'
                ? 'bg-white text-black'
                : 'text-white hover:bg-white/20'
              }`}
          >
            Original
          </button>
          <button
            onClick={() => setActiveTab('customized')}
            disabled={!customizedImage}
            className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === 'customized'
                ? 'bg-white text-black'
                : 'text-white hover:bg-white/20 disabled:text-gray-400 disabled:hover:bg-transparent'
              }`}
          >
            Customized
          </button>
        </div>
      </div>
    </div>
  );
});
ImageZoomModal.displayName = 'ImageZoomModal';