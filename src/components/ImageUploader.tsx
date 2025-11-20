import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CloseIcon, Loader2 } from './icons';
import { compressImage, validateImageFile } from '../lib/utils/imageOptimization';
import { showError } from '../lib/utils/toast';

export interface ImageUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ isOpen, onClose, onImageSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Conditionally compress if file is larger than 500KB
      if (file.size > 500 * 1024) {
        fileToProcess = await compressImage(file, {
          maxSizeMB: 1, // Compress to a max of 1MB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
      }
      onImageSelect(fileToProcess);
    } catch (error) {
      console.error('Error processing image:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      showError('Failed to process image.');
      onImageSelect(file); // fallback to original file
    } finally {
      setIsProcessing(false);
    }
  }, [onImageSelect]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen || isProcessing) return;

      if (e.clipboardData?.files?.length > 0) {
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

  const [show, setShow] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setShow(true), 10);
    } else {
      setShow(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isProcessing) return;
    setShow(false);
    setTimeout(onClose, 200);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      aria-modal="true" role="dialog"
    >
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center flex flex-col items-center gap-4 transition-all duration-200 ${show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <button onClick={handleClose} disabled={isProcessing} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50" aria-label="Close">
          <CloseIcon />
        </button>

        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-2xl z-10">
            <Loader2 className="animate-spin w-8 h-8 text-purple-500" />
            <span className="mt-4 font-semibold text-slate-600">Optimizing image...</span>
          </div>
        )}

        <div className={`w-full border-2 border-dashed rounded-lg p-10 transition-colors ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-300'}`}>
          <div className="flex flex-col items-center text-slate-500">
            <svg className="w-16 h-16 text-slate-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-slate-800">Upload Your Cake Design</h2>
            <p className="mt-2">Drag & drop, paste, or click to upload an image.</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="mt-6 bg-purple-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              Browse Files
            </button>
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
        <p className="text-xs text-slate-400 mt-2">Supports: WEBP, PNG, JPG. You can also paste an image from your clipboard.</p>
      </div>
    </div>
  );
};