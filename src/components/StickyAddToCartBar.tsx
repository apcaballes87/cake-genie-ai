'use client';
import React, { useState, useEffect } from 'react';
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
}

const StickyAddToCartBar: React.FC<StickyAddToCartBarProps> = React.memo(({ price, isLoading, isAdding, error, onAddToCartClick, onShareClick, isSharing, canShare, isAnalyzing, cakeInfo, warningMessage, warningDescription, onWarningClick, availability, className }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (price !== null || error || isAnalyzing || warningMessage) {
            setShow(true);
        } else {
            setShow(false);
        }
    }, [price, error, isAnalyzing, warningMessage]);


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
        // Hide availability bar during AI analysis
        if (isAnalyzing || !availability) return null;

        if (availability === 'rush') {
            return (
                <div className="bg-green-100 border-b border-green-200">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-green-800 text-xs sm:text-sm font-bold p-2">
                        <span>⚡</span>
                        <span>Rush Order Available! Ready in 30 mins</span>
                    </div>
                </div>
            );
        }
        if (availability === 'same-day') {
            return (
                <div className="bg-blue-100 border-b border-blue-200">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-blue-800 text-xs sm:text-sm font-bold p-2">
                        <span>🕐</span>
                        <span>Same-Day Order! Ready in 3 hours</span>
                    </div>
                </div>
            );
        }
        if (availability === 'normal') {
            return (
                <div className="bg-slate-100 border-b border-slate-200">
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
            {renderAvailabilityNotification()}
            {warningMessage && (
                <div
                    className={`bg-red-50 border-b border-red-200 group relative ${onWarningClick ? 'cursor-pointer hover:bg-red-100 transition-colors' : ''}`}
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
            <div className="bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
                <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                    <div className="min-w-[100px]">{renderPrice()}</div>
                    <div className="flex flex-1 gap-3">
                        <ShareButton
                            onClick={onShareClick}
                            isLoading={isSharing}
                            disabled={!canShare}
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