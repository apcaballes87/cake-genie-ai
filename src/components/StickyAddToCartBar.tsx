import React, { useState, useEffect } from 'react';
import { Loader2, SaveIcon } from './icons';
import { ShareButton } from './ShareButton';

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
  // New props for Save button
  onSave?: () => void;
  isSaving?: boolean;
  editedImage?: string | null;
}

const StickyAddToCartBar: React.FC<StickyAddToCartBarProps> = ({ price, isLoading, isAdding, error, onAddToCartClick, onShareClick, isSharing, canShare, isAnalyzing, onSave, isSaving, editedImage }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Show bar when analyzing or when we have edited image (for save/share buttons)
        if (price !== null || error || isAnalyzing || editedImage) {
            setShow(true);
        } else {
            setShow(false);
        }
    }, [price, error, isAnalyzing, editedImage]);


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
                    <span className="text-xs text-slate-500 block">Final Price</span>
                </div>
            );
        }
        return null;
    };
    
    return (
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
                <div className="max-w-4xl mx-auto flex justify-center items-center gap-3">
                    {/* TEMPORARILY HIDDEN - Price Display */}
                    {/* <div className="min-w-[100px]">{renderPrice()}</div> */}

                    {/* Save Button - now beside Share */}
                    {onSave && (
                        <button
                            onClick={onSave}
                            disabled={!editedImage || isLoading || isSaving}
                            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white border-2 border-purple-500 text-purple-600 font-bold rounded-xl shadow-sm hover:bg-purple-50 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={isSaving ? "Saving image" : "Save customized image"}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="hidden sm:inline">Saving...</span>
                                </>
                            ) : (
                                <>
                                    <SaveIcon className="w-5 h-5" />
                                    <span className="hidden sm:inline">Save</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Share Button */}
                    <ShareButton
                        onClick={onShareClick}
                        isLoading={isSharing}
                        disabled={!canShare}
                        className="flex-shrink-0"
                    />

                    {/* TEMPORARILY HIDDEN - Add to Cart Button */}
                    {/* <button
                        onClick={onAddToCartClick}
                        disabled={isLoading || !!error || price === null || isAdding || isAnalyzing}
                        className="w-full flex-grow bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex justify-center items-center"
                    >
                        {isAdding ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Adding...</> : 'Add to Cart'}
                    </button> */}
                </div>
            </div>
        </div>
    );
};

export default StickyAddToCartBar;