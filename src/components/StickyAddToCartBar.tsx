'use client';
import React from 'react';
import { Loader2, AlertTriangleIcon } from './icons';
import { ShareButton } from './ShareButton';
import { CakeInfoUI } from '@/types';
import { AvailabilityType } from '@/lib/utils/availability';

// --- Sticky Add to Cart Bar ---
interface StickyAddToCartBarProps {
    price: number | null;
    isLoading: boolean;
    isAdding: boolean;
    error: string | null;
    onAddToCartClick: () => void;
    onShareClick: () => void;
    isSharing: boolean;
    canShare: boolean;
    isAnalyzing?: boolean;
    cakeInfo?: CakeInfoUI | null;
    warningMessage?: string | null;
    warningDescription?: string | null;
    onWarningClick?: () => void;
    availability?: AvailabilityType;
    className?: string;
    hasPendingDesignChanges?: boolean;
    onApplyChangesClick?: () => void;
    isApplyingChanges?: boolean;
    applyChangesLabel?: string;
    // AI Chat
    chatInput?: string;
    onChatInputChange?: (value: string) => void;
    onChatSubmit?: () => void | Promise<void>;
    isAiProcessing?: boolean;
}

const StickyAddToCartBar: React.FC<StickyAddToCartBarProps> = React.memo(({
    price,
    isLoading,
    isAdding,
    error,
    onAddToCartClick,
    onShareClick,
    isSharing,
    canShare,
    isAnalyzing,
    cakeInfo,
    warningMessage,
    warningDescription,
    onWarningClick,
    availability,
    className,
    hasPendingDesignChanges = false,
    onApplyChangesClick,
    isApplyingChanges = false,
    applyChangesLabel = 'Apply Changes',
    chatInput = '',
    onChatInputChange,
    onChatSubmit,
    isAiProcessing = false,
}) => {
    const show = Boolean(price !== null || error || isAnalyzing || warningMessage || hasPendingDesignChanges || isApplyingChanges);

    const [showAvailability, setShowAvailability] = React.useState(false);

    React.useEffect(() => {
        if (isAnalyzing) {
            setShowAvailability(false);
        } else if (availability) {
            setShowAvailability(true);
            const timer = setTimeout(() => {
                setShowAvailability(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [availability, isAnalyzing]);

    const renderPrice = () => {
        if (isAnalyzing) {
            return (
                <div className="flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    <div className="text-left">
                        <span className="text-sm font-semibold text-slate-700">Analyzing...</span>
                        <span className="text-xs text-slate-500 block">Getting Price</span>
                    </div>
                </div>
            );
        }
        if (isLoading) return <span className="text-sm text-slate-500">Calculating...</span>;
        if (error) return <span className="text-sm font-semibold text-red-600">Pricing Error</span>;
        if (price !== null) {
            return (
                <div className="text-left">
                    <span className="text-lg font-bold text-slate-800">₱{price.toLocaleString()}</span>
                    {cakeInfo && cakeInfo.size && cakeInfo.thickness ? (
                        <span className="text-xs text-slate-500 block whitespace-nowrap">{`${cakeInfo.size} ${cakeInfo.thickness.replace(' in', '" Height')}`}</span>
                    ) : (
                        <span className="text-xs text-slate-500 block">Final Price</span>
                    )}
                </div>
            );
        }
        return null;
    };

    const renderAvailabilityNotification = () => {
        if (!availability) return null;

        if (availability === 'rush') {
            return (
                <div className="bg-green-100 border-b border-green-200 rounded-t-2xl pb-[8px] -mb-[8px]">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-green-800 text-xs sm:text-sm font-bold p-2">
                        <span>⚡</span>
                        <span>Rush Order Available! Ready in 30 mins</span>
                    </div>
                </div>
            );
        }
        if (availability === 'same-day') {
            return (
                <div className="bg-blue-100 border-b border-blue-200 rounded-t-2xl pb-[8px] -mb-[8px]">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-blue-800 text-xs sm:text-sm font-bold p-2">
                        <span>🕐</span>
                        <span>Same-Day Order! Ready in 3 hours</span>
                    </div>
                </div>
            );
        }
        if (availability === 'normal') {
            return (
                <div className="bg-slate-100 border-b border-slate-200 rounded-t-2xl pb-[8px] -mb-[8px]">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-slate-700 text-xs sm:text-sm font-bold p-2">
                        <span>📅</span>
                        <span>Standard order. Requires 1-day lead time</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'} ${className || ''}`}>
            <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${showAvailability && availability ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden rounded-t-2xl">
                    {renderAvailabilityNotification()}
                </div>
            </div>
            {warningMessage && (
                <div
                    className={`bg-red-50 border-b border-red-200 rounded-t-2xl pb-[8px] -mb-[8px] group relative ${onWarningClick ? 'cursor-pointer hover:bg-red-100 transition-colors' : ''}`}
                    onClick={onWarningClick}
                >
                    <div className={`max-w-4xl mx-auto flex items-center justify-center gap-2 text-red-800 text-xs sm:text-sm font-semibold p-2 ${!onWarningClick ? 'cursor-help' : ''}`}>
                        <AlertTriangleIcon className="w-5 h-5 text-red-600 shrink-0" />
                        <span>{warningMessage}</span>
                    </div>
                    {/* Tooltip */}
                    {warningDescription && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 text-center leading-relaxed pointer-events-none">
                            {warningDescription}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                    )}
                </div>
            )}
            <div className="relative z-10 bg-white/80 backdrop-blur-lg px-3 pt-3 pb-[20px] rounded-t-2xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
                <div className="max-w-4xl mx-auto mb-2 relative">
                    <textarea 
                        placeholder="✨ Tell Genie your cake design wish..."
                        className="bg-transparent border-none outline-none resize-none px-1 py-1 pr-16 text-slate-700 w-full text-[15px] font-medium placeholder:text-slate-500/70"
                        rows={1}
                        value={chatInput}
                        onChange={(e) => onChatInputChange?.(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void onChatSubmit?.();
                            }
                        }}
                        disabled={isAiProcessing}
                    />
                    <button
                        type="button"
                        onClick={() => void onChatSubmit?.()}
                        disabled={!chatInput.trim() || isAiProcessing}
                        className="absolute right-0 top-0 bottom-0 bg-linear-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white px-3 transition-all flex items-center justify-center shadow-sm rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Submit AI Edit"
                    >
                        {isAiProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        )}
                    </button>
                </div>
                <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                    <div className="min-w-[100px]">{renderPrice()}</div>
                    <div className="flex flex-1 gap-3">
                        <ShareButton
                            onClick={onShareClick}
                            isLoading={isSharing}
                            disabled={!canShare || isApplyingChanges}
                            className="flex-1"
                        />
                        <button
                            onClick={onAddToCartClick}
                            disabled={isLoading || !!error || price === null || isAdding || isAnalyzing}
                            className="flex-1 bg-linear-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex justify-center items-center"
                        >
                            {isAdding ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Adding...</> : 'Add to Cart'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

StickyAddToCartBar.displayName = 'StickyAddToCartBar';

export default StickyAddToCartBar;