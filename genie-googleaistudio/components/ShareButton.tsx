'use client';

import React from 'react';
import { Share2Icon, Loader2 } from './icons';

interface ShareButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ 
  onClick, 
  isLoading = false,
  disabled = false,
  className = '' 
}) => {
  const isEffectivelyDisabled = isLoading || disabled;
  const tooltipText = "Customize design to share";
  const showTooltip = disabled && !isLoading;

  return (
    <div className={`relative group ${className}`}>
      <button
        onClick={onClick}
        disabled={isEffectivelyDisabled}
        className={`
          w-full flex items-center justify-center gap-2
          px-4 py-3 h-full
          bg-white border-2 border-pink-500 
          text-pink-600 font-bold text-sm
          rounded-xl shadow-sm
          hover:bg-pink-50 hover:shadow-md
          transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label={isLoading ? "Generating share link" : "Share your cake design"}
        type="button"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Sharing...</span>
          </>
        ) : (
          <>
            <Share2Icon className="w-5 h-5" />
            <span>Share</span>
          </>
        )}
      </button>
      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md invisible group-hover:visible transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none z-10 text-center">
          {tooltipText}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};