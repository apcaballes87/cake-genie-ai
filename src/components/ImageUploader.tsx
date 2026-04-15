'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CloseIcon, Loader2 } from './icons';
import { compressImage, validateImageFile } from '@/lib/utils/imageOptimization';
import { showError } from '@/lib/utils/toast';

export interface ImageUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (file: File) => void;
  variant?: 'modal' | 'inline';
  compact?: boolean;
  compactAlignment?: 'left' | 'center' | 'inline-center';
  className?: string;
  browseLabel?: string;
  title?: string;
  showBrowseButton?: boolean;
  iconImageSrc?: string;
  iconImageAlt?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  isOpen,
  onClose,
  onImageSelect,
  variant = 'modal',
  compact = false,
  compactAlignment = 'left',
  className = '',
  browseLabel = 'Browse Files',
  title = 'Upload any Image',
  showBrowseButton = true,
  iconImageSrc,
  iconImageAlt = 'Upload icon',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [show, setShow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = useCallback(async (file: File | null) => {
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid && validation.error) {
      showError(validation.error);
      return;
    }

    setIsProcessing(true);
    try {
      let fileToProcess = file;
      if (file.size > 500 * 1024) {
        fileToProcess = await compressImage(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
      }
      onImageSelect(fileToProcess);
    } catch (error) {
      console.error('Error processing image:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      showError('Failed to process image.');
      onImageSelect(file);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageSelect]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen || isProcessing) return;

      // Check if this instance is visible (not hidden via display: none for responsive layouts)
      if (containerRef.current && containerRef.current.offsetParent === null) {
        return;
      }

      if (e.clipboardData?.files?.length && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          handleFileSelect(file);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, isProcessing, handleFileSelect]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setShow(true), 10);
    } else {
      setShow(false);
    }
  }, [isOpen]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragging(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [isProcessing, handleFileSelect]);

  const handleClose = () => {
    if (isProcessing) return;
    setShow(false);
    setTimeout(onClose, 200);
  };

  if (!isOpen) {
    return null;
  }

  const isInline = variant === 'inline';
  const isCompactCentered = compact && compactAlignment === 'center';
  const isCompactInlineCentered = compact && compactAlignment === 'inline-center';

  const content = (
    <div
      ref={containerRef}
      className={`relative bg-white ${isInline ? 'rounded-[1.55rem] border border-purple-100/90 shadow-[0_20px_50px_-34px_rgba(109,40,217,0.55)]' : 'rounded-2xl shadow-2xl'} w-full ${isInline ? '' : 'max-w-lg'} ${compact ? `p-1 md:p-1.5 ${isCompactCentered || isCompactInlineCentered ? 'text-center' : 'text-left'}` : 'p-8 text-center'} flex flex-col items-center gap-4 transition-all duration-200 ${isInline ? 'opacity-100 scale-100' : show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${className}`}
      onClick={(e) => {
        if (!isInline) {
          e.stopPropagation();
        }
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!isInline ? (
        <button onClick={handleClose} disabled={isProcessing} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50" aria-label="Close">
          <CloseIcon />
        </button>
      ) : null}

      {isProcessing && (
        <div className={`absolute inset-0 bg-white/80 flex flex-col items-center justify-center ${isInline ? 'rounded-[1.35rem]' : 'rounded-2xl'} z-10`}>
          <Loader2 className="animate-spin w-8 h-8 text-purple-500" />
          <span className="mt-4 font-semibold text-slate-600">Optimizing image...</span>
        </div>
      )}

      <div
        className={`w-full border-2 border-dashed transition-colors cursor-pointer ${compact ? 'rounded-xl p-[8px] max-[416px]:p-[7px] md:p-3' : 'rounded-lg p-10'} ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-300 hover:border-purple-300 hover:bg-purple-50/40'}`}
        onClick={() => {
          if (!isProcessing) {
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <div className={`flex ${compact ? `${isCompactCentered ? 'flex-col items-center gap-3 text-center' : isCompactInlineCentered ? 'items-center justify-center gap-4' : 'items-center justify-between gap-4'}` : 'flex-col items-center text-center'} text-slate-500`}>
          <div className={`flex ${compact ? `${isCompactCentered ? 'flex-col items-center' : 'items-center gap-3'}` : 'flex-col items-center'}`}>
            {iconImageSrc ? (
              <img
                src={iconImageSrc}
                alt={iconImageAlt}
                className={`${compact ? `${isCompactCentered ? 'w-22 h-22 mt-1' : 'w-13 h-13'}` : 'w-16 h-16 mb-4'} shrink-0 object-contain`}
              />
            ) : (
              <svg className={`${compact ? `${isCompactCentered ? 'w-22 h-22 mt-1' : 'w-13 h-13'}` : 'w-16 h-16 mb-4'} shrink-0 text-slate-400`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            )}
            <div className={`relative group ${isCompactCentered ? 'text-center' : isCompactInlineCentered ? 'text-left' : ''}`}>
              <h2 className={`${compact ? `${isCompactCentered ? 'text-lg' : 'text-base leading-tight max-[416px]:text-[0.78rem]'}` : 'text-xl'} font-semibold text-slate-800`}>{title}</h2>
              <p className={`mt-1 ${compact ? `${isCompactCentered ? 'max-w-md text-base leading-relaxed' : 'max-w-60 text-sm leading-snug max-[416px]:text-[0.56rem]'}` : 'text-base mt-2'}`}>Drag &amp; drop, paste, or click to upload an image.</p>
            </div>
          </div>
          {showBrowseButton ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isProcessing}
              className={`${compact ? 'shrink-0 rounded-full px-4 py-2 text-[0.78rem]' : 'mt-6 rounded-lg py-2 px-6'} bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50`}
            >
              {browseLabel}
            </button>
          ) : null}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/webp,image/png,image/jpeg"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
            }}
          />
        </div>
      </div>
      {!compact ? (
        <p className="text-xs text-slate-400 mt-2">Supports: WEBP, PNG, JPG. You can also paste an image from your clipboard.</p>
      ) : null}
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      {content}
    </div>
  );
};
