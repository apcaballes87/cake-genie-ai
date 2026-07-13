'use client';

import React from 'react';
import { Share2Icon, Loader2, MessageCircle } from './icons';

interface ShareButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  showText?: boolean;
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ 
  onClick, 
  isLoading = false,
  disabled = false,
  disabledReason = "Customize design to share",
  showText = true,
  className = '' 
}) => {
  const isEffectivelyDisabled = isLoading || disabled;
  const tooltipText = disabledReason;
  const showTooltip = disabled && !isLoading;

  return (
    <div className={`relative group ${className}`}>
      <button
        onClick={onClick}
        disabled={isEffectivelyDisabled}
        title={showTooltip ? tooltipText : undefined}
        className={`
          flex items-center justify-center
          w-11 h-11 max-md:min-h-[44px] max-md:min-w-[44px] sm:w-auto sm:h-12 min-[420px]:max-[639px]:px-0 min-[420px]:max-[639px]:gap-0 sm:px-4 sm:gap-2
          genie-btn-secondary
          font-bold text-sm
          rounded-xl shadow-sm
          transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          whitespace-nowrap
        `}
        aria-label={isLoading ? "Generating share link" : "Share your cake design"}
        type="button"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="hidden sm:inline">Sharing...</span>
          </>
        ) : (
          <>
            <Share2Icon className="w-5 h-5" />
            <span className="hidden sm:inline">Share</span>
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

interface ChatButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  showText?: boolean;
  className?: string;
}

export const ChatButton: React.FC<ChatButtonProps> = ({ 
  onClick, 
  isLoading = false,
  disabled = false,
  disabledReason,
  showText = true,
  className = '' 
}) => {
  const isEffectivelyDisabled = isLoading || disabled;

  return (
    <button
      onClick={onClick}
      disabled={isEffectivelyDisabled}
      title={isEffectivelyDisabled ? disabledReason : undefined}
      className={`
        flex items-center justify-center
        w-11 h-11 max-md:min-h-[44px] max-md:min-w-[44px] sm:w-auto sm:h-12 min-[420px]:max-[639px]:px-0 min-[420px]:max-[639px]:gap-0 sm:px-4 sm:gap-2
        genie-btn-secondary
        font-bold text-sm
        rounded-xl shadow-sm
        transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        whitespace-nowrap
        ${className}
      `}
      aria-label={isLoading ? "Opening chat" : "Chat with us"}
      type="button"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="hidden sm:inline">Connecting...</span>
        </>
      ) : (
        <>
          <MessageCircle className="w-5 h-5" />
          <span className="hidden sm:inline">Chat</span>
        </>
      )}
    </button>
  );
};
