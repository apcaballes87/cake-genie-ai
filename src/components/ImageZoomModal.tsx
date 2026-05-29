'use client';
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import LazyImage from './LazyImage';

type ImageTab = 'original' | 'customized';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: string | null;
  customizedImage: string | null;
  initialTab?: ImageTab;
}

type ImageZoomModalContentProps = Omit<ImageZoomModalProps, 'isOpen'>;

const ImageZoomModalContent = React.memo<ImageZoomModalContentProps>(({
  onClose,
  originalImage,
  customizedImage,
  initialTab = 'original',
}) => {
  const hasCustomized = Boolean(customizedImage && customizedImage.trim());
  const [activeTab, setActiveTab] = useState<ImageTab>(
    hasCustomized ? initialTab : 'original',
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('genie-image-zoom-open');

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('genie-image-zoom-open');
    };
  }, []);

  const currentImage = activeTab === 'customized' ? (customizedImage || originalImage) : originalImage;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex flex-col items-center justify-center p-4 transition-opacity duration-200 opacity-100"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Full screen image preview"
    >
      <div
        className="w-full max-w-[90vw] sm:max-w-[80vw] lg:max-w-[70vw] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className={`w-full flex items-center gap-3 ${hasCustomized ? 'justify-between' : 'justify-end'}`}>
          {hasCustomized && (
            <div className="bg-black/40 p-1.5 rounded-full flex gap-2 backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('original')}
                className={`px-4 sm:px-6 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === 'original'
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white/20'
                  }`}
              >
                Original
              </button>
              <button
                onClick={() => setActiveTab('customized')}
                className={`px-4 sm:px-6 py-2 text-sm font-semibold rounded-full transition-colors ${activeTab === 'customized'
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-white/20'
                  }`}
              >
                Customized
              </button>
            </div>
          )}

          <button
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="shrink-0 text-white p-2.5 rounded-full bg-black/45 hover:bg-black/65 transition-colors shadow-lg"
            aria-label="Close zoomed image"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full h-[75vh]">
          {currentImage ? (
            <LazyImage
              src={currentImage}
              alt={activeTab === 'customized' ? 'Customized cake design' : 'Original cake design'}
              fill
              sizes="100vw"
              imageClassName="object-contain"
              priority
              unoptimized
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});

ImageZoomModalContent.displayName = 'ImageZoomModalContent';

export const ImageZoomModal = React.memo<ImageZoomModalProps>((props) => {
  const { isOpen, initialTab = 'original', originalImage, customizedImage } = props;

  if (!isOpen) {
    return null;
  }

  const resetKey = `${initialTab}:${originalImage ?? ''}:${customizedImage ?? ''}`;

  return <ImageZoomModalContent key={resetKey} {...props} />;
});

ImageZoomModal.displayName = 'ImageZoomModal';
