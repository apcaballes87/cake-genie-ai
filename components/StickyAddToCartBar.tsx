import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangleIcon } from './icons';
import { ShareButton } from './ShareButton';
import { CakeInfoUI } from '../types';

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
}

const StickyAddToCartBar: React.FC<StickyAddToCartBarProps> = React.memo(({ price, isLoading, isAdding, error, onAddToCartClick, onShareClick, isSharing, canShare, isAnalyzing, cakeInfo, warningMessage }) => {
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
    
    return (
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'}`}>
            {warningMessage && (
                <div className="bg-yellow-100 border-b border-yellow-200">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-yellow-800 text-xs sm:text-sm font-semibold p-2">
                        <AlertTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                        <span>{warningMessage}</span>
                    </div>
                </div>
            )}
            <div className="bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
                <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                    <div className="min-w-[100px]">{renderPrice()}</div>
                    <div className="flex gap-3 w-full sm:w-auto flex-grow sm:flex-grow-0 items-center">
                        {/* This spacer will take up 10% of the available space on mobile screens, making the button group slightly smaller */}
                        <div className="flex-grow sm:flex-grow-0"></div>
                        <ShareButton 
                            onClick={onShareClick}
                            isLoading={isSharing}
                            disabled={!canShare}
                            className="flex-shrink-0"
                        />
                        <button 
                            onClick={onAddToCartClick}
                            disabled={isLoading || !!error || price === null || isAdding || isAnalyzing}
                            className="flex-grow-[9] sm:flex-grow bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex justify-center items-center"
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