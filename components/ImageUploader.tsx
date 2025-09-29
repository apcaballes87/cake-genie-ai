import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CloseIcon } from './icons';

interface ImageUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ isOpen, onClose, onImageSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file);
    } else {
      alert("Invalid file type. Please upload an image.");
    }
  }, [onImageSelect]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      
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
  }, [isOpen, handleFileSelect]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [handleFileSelect]);

  const [show, setShow] = useState(false);
  useEffect(() => {
      if(isOpen) {
          setTimeout(() => setShow(true), 10);
      } else {
          setShow(false);
      }
  }, [isOpen]);

  const handleClose = () => {
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
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
            <CloseIcon />
        </button>
        
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
                    className="mt-6 bg-purple-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors"
                >
                    Browse Files
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => {
                        if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                />
            </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Supports: PNG, JPG, WEBP. You can also paste an image from your clipboard.</p>
      </div>
    </div>
  );
};