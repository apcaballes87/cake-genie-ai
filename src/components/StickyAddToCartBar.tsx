'use client';
import React from 'react';
import { Loader2, AlertTriangleIcon } from './icons';
import { X, ShieldCheck, ShoppingBag } from 'lucide-react';
import { ShareButton, ChatButton } from './ShareButton';
import { CakeInfoUI } from '@/types';
import { AvailabilityType } from '@/lib/utils/availability';
import { ColorPalette } from './ColorPalette';
import type { CustomizingAiPromptSuggestionItem } from '@/app/customizing/CustomizingAiChatPanel';
import type { ParsedAiChatPromptTemplate } from '@/utils/aiChatPromptComposer';
import { DiscountOfferBubble } from './DiscountOfferBubble';

// --- Sticky Add to Cart Bar ---
interface StickyAddToCartBarProps {
    price: number | null;
    isLoading: boolean;
    isAdding: boolean;
    error: string | null;
    onAddToCartClick: () => void;
    onShareClick: () => void;
    onChatClick?: () => void;
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
    ediblePhotoAddonNote?: boolean;
    isBlurred?: boolean;
}

const StickyAddToCartBar: React.FC<StickyAddToCartBarProps> = React.memo(({
    price,
    isLoading,
    isAdding,
    error,
    onAddToCartClick,
    onShareClick,
    onChatClick,
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
    ediblePhotoAddonNote = false,
    isBlurred = false,
}) => {
    const show = Boolean(price !== null || error || isAnalyzing || warningMessage || hasPendingDesignChanges || isApplyingChanges || availability);

    const showAvailability = Boolean(availability && !isAnalyzing && !error);
    const hasTopNotification = !error && (Boolean(warningMessage) || (showAvailability && Boolean(availability)));
    const addToCartDisabledReason = isAnalyzing
        ? 'Wait for analysis to finish before buying'
        : isLoading
            ? 'Price is still calculating'
            : error
                ? 'Resolve the pricing issue before buying'
                : price === null
                    ? 'Upload or select a cake design first'
                    : isAdding
                        ? 'Adding this cake to your cart'
                        : undefined;
    const shareDisabledReason = isApplyingChanges
        ? 'Apply pending changes before sharing'
        : !canShare
            ? 'Customize design to share'
            : undefined;


    const [isCompact, setIsCompact] = React.useState(false);
    const [isDiscountApplied, setIsDiscountApplied] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);
    const buttonsRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setIsMounted(true);
        // Check for discount on mount
        const appliedCode = localStorage.getItem('cart_discount_code');
        if (appliedCode) {
            setIsDiscountApplied(true);
        }
    }, []);

    React.useEffect(() => {
        const currentRef = buttonsRef.current;
        if (!currentRef) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // If width is less than ~280px, we switch to compact mode (icons only)
                // This value is based on: Share Button (~90px) + Chat Button (~90px) + "Buy This Now" (~130px) + gaps.
                setIsCompact(entry.contentRect.width < 280);
            }
        });

        observer.observe(currentRef);
        return () => observer.disconnect();
    }, []);

    const renderPrice = () => {
        if (isAnalyzing) {
            return (
                <div className="flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    <div className="text-left">
                        <span className="text-sm font-semibold text-slate-700">Analyzing...</span>
                        <div className="flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5 text-green-600" />
                            <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider">Price Guaranteed</span>
                        </div>
                    </div>
                </div>
            );
        }
        if (isLoading) return <span className="text-sm text-slate-500">Calculating...</span>;
        if (error) return <span className="text-sm font-semibold text-red-600">{error.includes('AI') ? 'Analysis Error' : 'Pricing Error'}</span>;
        if (price !== null) {
            const finalPriceValue = isDiscountApplied ? price * 0.8 : price;

            return (
                <div className="text-left">
                    {isDiscountApplied ? (
                        <div className="flex flex-col relative">
                            {/* Floating Pill Above Price */}
                            <div className="absolute bottom-[calc(100%+2px)] left-3 flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full text-[8px] font-black border border-green-100 uppercase tracking-tighter shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300">
                                <span>DISCOUNT APPLIED</span>
                            </div>
                            <div className="flex items-center gap-1.5 leading-tight">
                                <span className="text-xs text-slate-400 line-through">₱{price.toLocaleString()}</span>
                                <span className="text-lg font-bold text-slate-800">₱{finalPriceValue.toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-lg font-bold text-slate-800">₱{price.toLocaleString()}</span>
                    )}
                    
                    {cakeInfo && cakeInfo.size && cakeInfo.thickness ? (
                        <span className="text-[9px] text-slate-500 block whitespace-nowrap">{`${cakeInfo.size} ${cakeInfo.thickness.replace(' in', '" Height')}`}</span>
                    ) : (
                        <span className="text-[10px] text-slate-500 block">Final Price</span>
                    )}
                    {ediblePhotoAddonNote && (
                        <span className="text-[9px] text-purple-600 font-semibold block">+ Edible Photo</span>
                    )}
                </div>
            );
        }
        return null;
    };

    const renderWarningNotification = (isTopmost: boolean) => {
        if (!warningMessage) return null;

        return (
            <div
                className={`bg-red-50 group relative transition-colors ${isTopmost ? 'rounded-t-2xl' : ''} ${onWarningClick ? 'cursor-pointer hover:bg-red-100' : ''}`}
                onClick={onWarningClick}
            >
                <div className={`max-w-4xl mx-auto flex items-center justify-center gap-2 text-red-800 text-[10px] sm:text-[11px] font-bold p-1 ${!onWarningClick ? 'cursor-help' : ''}`}>
                    <AlertTriangleIcon className="w-5 h-5 text-red-600 shrink-0" />
                    <span>{warningMessage}</span>
                </div>
                {warningDescription && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 text-center font-normal leading-relaxed pointer-events-none">
                        {warningDescription}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                )}
            </div>
        );
    };

    const renderAvailabilityNotification = (isTopmost: boolean) => {
        if (!availability || !showAvailability) return null;

        if (availability === 'rush') {
            return (
                <div className={`bg-green-100 ${isTopmost ? 'rounded-t-2xl' : ''}`}>
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-green-800 text-[10px] sm:text-[11px] font-bold p-1">
                        <span>⚡</span>
                        <span>Rush Order Available! Ready in 60 mins</span>
                    </div>
                </div>
            );
        }
        if (availability === 'same-day') {
            return (
                <div className={`bg-blue-100 ${isTopmost ? 'rounded-t-2xl' : ''}`}>
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-blue-800 text-[10px] sm:text-[11px] font-bold p-1">
                        <span>🕐</span>
                        <span>Same-Day Order! Ready in 3 hours</span>
                    </div>
                </div>
            );
        }
        if (availability === 'normal') {
            return (
                <div className={`bg-slate-100 ${isTopmost ? 'rounded-t-2xl' : ''}`}>
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-slate-700 text-[10px] sm:text-[11px] font-bold p-1">
                        <span>📅</span>
                        <span>Standard order. Receive this by tomorrow</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    const bottomNotificationColor =
        showAvailability && availability === 'rush' ? 'bg-green-100' :
        showAvailability && availability === 'same-day' ? 'bg-blue-100' :
        showAvailability && availability === 'normal' ? 'bg-slate-100' :
        warningMessage ? 'bg-red-50' : '';

    const notificationBridgeColor =
        bottomNotificationColor;

    return (
        <>
            {/* Top Section: Warnings & Availability (z-60) */}
            <div
                data-sticky-add-to-cart-bar
                className={`fixed bottom-0 left-0 right-0 z-85 pointer-events-none transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'} ${className || ''}`}
            >
                <div className={`pointer-events-auto transition-all duration-300 ${isBlurred ? 'blur-[2px] opacity-50 pointer-events-none' : ''}`}>
                    <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${hasTopNotification ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="relative overflow-visible">
                            {renderWarningNotification(true)}
                            {renderAvailabilityNotification(!warningMessage)}
                        </div>
                    </div>
                    {/* Bridge: 16px of matching color outside overflow-hidden, fills the transparent
                        rounded-corner area at the top of the main bar (border-radius = 1rem = 16px) */}
                    <div className={`h-4 transition-opacity duration-500 ease-in-out ${hasTopNotification ? 'opacity-100' : 'opacity-0'} ${notificationBridgeColor}`} />
                </div>
                {/* Spacer: height matches the main bar */}
                <div className="h-[72px]" />
            </div>

            {/* Bottom Section: Main Action Bar (z-90) */}
            <div
                data-sticky-add-to-cart-bar
                className={`fixed bottom-0 left-0 right-0 z-90 pointer-events-none transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'} ${className || ''}`}
            >
                <div className={`relative pointer-events-auto bg-white/80 backdrop-blur-lg px-3 pt-3 pb-[20px] rounded-t-2xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] ${hasTopNotification ? 'border-t border-transparent' : 'border-t border-slate-200'} transition-all duration-300 ${isBlurred ? 'blur-[2px] opacity-50 pointer-events-none' : ''}`}>
                    <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                        <div className="min-w-[80px] min-h-[48px] flex items-center">
                            <div className="relative">
                                {renderPrice()}
                                {isMounted && price !== null && !isAnalyzing && !isLoading && !error && !isDiscountApplied && (
                                    <DiscountOfferBubble 
                                        basePrice={price} 
                                        onApplied={() => setIsDiscountApplied(true)}
                                        isShiftedUp={hasTopNotification}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-1 gap-2 min-w-0" ref={buttonsRef}>
                            <ShareButton
                                onClick={onShareClick}
                                isLoading={isSharing}
                                disabled={!canShare || isApplyingChanges}
                                disabledReason={shareDisabledReason}
                                className="shrink-0"
                                showText={!isCompact}
                            />
                            {onChatClick && (
                                <ChatButton
                                    onClick={onChatClick}
                                    className="shrink-0"
                                    showText={!isCompact}
                                />
                            )}
                            <button
                                onClick={onAddToCartClick}
                                disabled={isLoading || !!error || price === null || isAdding || isAnalyzing}
                                title={addToCartDisabledReason}
                                aria-label={addToCartDisabledReason || 'Buy this cake now'}
                                className="flex-1 min-w-0 h-12 genie-btn-primary font-bold py-3 px-4 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md whitespace-nowrap"
                            >
                                {isAdding ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> {!isCompact && 'Processing...'}</>
                                ) : (
                                    <>
                                        <ShoppingBag className="w-5 h-5 shrink-0" />
                                        {!isCompact && 'Buy This Now'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    {addToCartDisabledReason && (
                        <p className="mt-2 text-center text-[10px] font-medium text-slate-500 sm:hidden">
                            {addToCartDisabledReason}
                        </p>
                    )}
                </div>
            </div>
        </>
    );
});

StickyAddToCartBar.displayName = 'StickyAddToCartBar';

export default StickyAddToCartBar;
