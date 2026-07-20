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
import type { PrintoutConversionSummary } from '@/app/customizing/printoutConversion';
import {
    STICKY_ADD_TO_CART_AVAILABILITY_OVERLAP_PX,
    STICKY_ADD_TO_CART_AVAILABILITY_VERTICAL_PADDING_PX,
} from '@/app/customizing/stickyBarLayout';
import {
    getAddToCartBlockLabel,
    getAddToCartBlockReason,
    type AddToCartBlockReason,
} from '@/lib/customizerAddToCart';

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
    printoutConversions?: PrintoutConversionSummary;
    onAddToCartUnavailableVisible?: (reason: AddToCartBlockReason) => void;
    onAddToCartBlockedClick?: (reason: AddToCartBlockReason) => void;
    onRetryClick?: () => void;
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
    printoutConversions,
    onAddToCartUnavailableVisible,
    onAddToCartBlockedClick,
    onRetryClick,
}) => {
    const announcementStateRef = React.useRef<{
        price: number | null;
        availability: AvailabilityType | undefined;
        error: string | null;
        initialized: boolean;
    }>({
        price,
        availability,
        error,
        initialized: false,
    });
    const hasPrintoutConversion = Boolean(
        printoutConversions?.toy || printoutConversions?.ediblePhoto || printoutConversions?.cardstock,
    );
    const showAvailability = Boolean(availability && !isAnalyzing && !error);
    const showPrintoutNotification = Boolean(hasPrintoutConversion && !isAnalyzing && !error);
    const hasTopNotification = !error && (showAvailability || showPrintoutNotification);
    const show = Boolean(price !== null || error || isAnalyzing || hasPendingDesignChanges || isApplyingChanges || availability || hasPrintoutConversion);
    const addToCartBlockReason = getAddToCartBlockReason({
        isAdding,
        isAnalyzing,
        isLoading,
        error,
        price,
        hasCakeInfo: Boolean(cakeInfo),
    });
    const addToCartDisabledReason = getAddToCartBlockLabel(addToCartBlockReason);
    const shareDisabledReason = isApplyingChanges
        ? 'Apply pending changes before sharing'
        : !canShare
            ? 'Customize design to share'
            : undefined;


    const [isCompact, setIsCompact] = React.useState(false);
    const [isDiscountApplied, setIsDiscountApplied] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);
    const [statusAnnouncement, setStatusAnnouncement] = React.useState('');
    const [errorAnnouncement, setErrorAnnouncement] = React.useState('');
    const buttonsRef = React.useRef<HTMLDivElement>(null);
    const lastVisibleBlockReasonRef = React.useRef<AddToCartBlockReason | null>(null);

    React.useEffect(() => {
        setIsMounted(true);
        // Check for discount on mount
        const appliedCode = localStorage.getItem('cart_discount_code');
        const storedAppliedDiscount = localStorage.getItem('cart_applied_discount');
        let parsedAppliedDiscount: { valid?: boolean; codeId?: string } | null = null;
        try {
            parsedAppliedDiscount = storedAppliedDiscount ? JSON.parse(storedAppliedDiscount) : null;
        } catch {
            parsedAppliedDiscount = null;
        }

        if (appliedCode && parsedAppliedDiscount?.valid && parsedAppliedDiscount.codeId) {
            setIsDiscountApplied(true);
        }
    }, []);

    React.useEffect(() => {
        if (!addToCartBlockReason) {
            lastVisibleBlockReasonRef.current = null;
            return;
        }
        if (lastVisibleBlockReasonRef.current === addToCartBlockReason) return;
        lastVisibleBlockReasonRef.current = addToCartBlockReason;
        onAddToCartUnavailableVisible?.(addToCartBlockReason);
    }, [addToCartBlockReason, onAddToCartUnavailableVisible]);

    React.useEffect(() => {
        const previous = announcementStateRef.current;

        if (!previous.initialized) {
            announcementStateRef.current = {
                price,
                availability,
                error,
                initialized: true,
            };
            return;
        }

        if (error && error !== previous.error) {
            setErrorAnnouncement(error.includes('AI') ? 'Analysis error. Please review the current design state.' : error);
        } else if (!error) {
            setErrorAnnouncement('');
        }

        const statusParts: string[] = [];

        if (price !== null && price !== previous.price) {
            statusParts.push(`Price updated to ${price.toLocaleString()} pesos.`);
        }

        if (availability && availability !== previous.availability) {
            if (availability === 'rush') {
                statusParts.push('Rush fulfillment available. Ready in 60 minutes.');
            } else if (availability === 'same-day') {
                statusParts.push('Same-day fulfillment available. Ready in 3 hours.');
            } else {
                statusParts.push('Standard order selected. At least one day lead time applies.');
            }
        }

        if (statusParts.length > 0) {
            setStatusAnnouncement(statusParts.join(' '));
        }

        announcementStateRef.current = {
            price,
            availability,
            error,
            initialized: true,
        };
    }, [availability, error, price]);

    React.useEffect(() => {
        const currentRef = buttonsRef.current;
        if (!currentRef) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // If width is less than ~280px, we switch to compact mode (icons only)
                // This value is based on: Share Button (~90px) + Chat Button (~90px) + "Add to Cart" (~130px) + gaps.
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
                            <span className="text-[9px] max-md:text-[8px] text-green-600 font-bold uppercase tracking-wider">Price Guaranteed</span>
                        </div>
                    </div>
                </div>
            );
        }
        if (isLoading) return <span className="text-sm text-slate-500">Calculating...</span>;
        if (error) return (
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-red-600">{error.includes('AI') ? 'Analysis Error' : 'Pricing Error'}</span>
                {onRetryClick && !error.includes('AI') && (
                    <button type="button" onClick={onRetryClick} className="text-xs font-bold text-purple-700 underline underline-offset-2">
                        Retry
                    </button>
                )}
            </div>
        );
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
                        <span className="text-[9px] max-md:text-[8px] text-slate-500 block whitespace-nowrap">{`${cakeInfo.size} ${cakeInfo.thickness.replace(' in', '" Height')}`}</span>
                    ) : (
                        <span className="text-[10px] max-md:text-[9px] text-slate-500 block">Final Price</span>
                    )}
                    {ediblePhotoAddonNote && (
                        <span className="text-[9px] max-md:text-[8px] text-purple-600 font-semibold block">+ Edible Photo</span>
                    )}
                </div>
            );
        }
        return null;
    };

    const notificationBodyStyle = {
        paddingTop: '2px',
        paddingBottom: `${STICKY_ADD_TO_CART_AVAILABILITY_VERTICAL_PADDING_PX}px`,
    } satisfies React.CSSProperties;

    const renderAvailabilityNotification = () => {
        if (!availability || !showAvailability) return null;

        if (availability === 'rush') {
            return (
                <div className="bg-green-100 rounded-t-2xl">
                    <div
                        className="max-w-4xl mx-auto flex items-start justify-center gap-2 px-1 text-green-800 text-[10px] max-md:text-[9px] sm:text-[11px] font-bold"
                        style={notificationBodyStyle}
                    >
                        <span>⚡</span>
                        <span>Rush Order Available! Ready in 60 mins</span>
                    </div>
                </div>
            );
        }
        if (availability === 'same-day') {
            return (
                <div className="bg-blue-100 rounded-t-2xl">
                    <div
                        className="max-w-4xl mx-auto flex items-start justify-center gap-2 px-1 text-blue-800 text-[10px] max-md:text-[9px] sm:text-[11px] font-bold"
                        style={notificationBodyStyle}
                    >
                        <span>🕐</span>
                        <span>Same-Day Order! Ready in 3 hours</span>
                    </div>
                </div>
            );
        }
        if (availability === 'normal') {
            return (
                <div className="bg-slate-100 rounded-t-2xl">
                    <div
                        className="max-w-4xl mx-auto flex items-start justify-center gap-2 px-1 text-slate-700 text-[10px] max-md:text-[9px] sm:text-[11px] font-bold"
                        style={notificationBodyStyle}
                    >
                        <span>📅</span>
                        <span>Standard order. Receive this by tomorrow</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    const renderPrintoutNotification = () => {
        if (!hasPrintoutConversion || !showPrintoutNotification) return null;

        return (
            <div data-printout-notification className="h-[29.5px] translate-y-[4px] bg-red-100 rounded-t-2xl">
                <div
                    className="h-full max-w-4xl mx-auto flex items-start justify-center gap-2 px-1 text-red-800 text-[10px] max-md:text-[9px] sm:text-[11px] font-bold"
                    style={notificationBodyStyle}
                >
                    <span>⚠️</span>
                    <span className="min-w-0 truncate text-center">
                        {[
                            printoutConversions?.toy && 'Toy',
                            printoutConversions?.ediblePhoto && 'Edible photo',
                            printoutConversions?.cardstock && 'Cardstock',
                        ].filter(Boolean).join(', ')} changed to printout
                    </span>
                </div>
            </div>
        );
    };

    const bottomNotificationColor =
        showAvailability && availability === 'rush' ? 'bg-green-100' :
        showAvailability && availability === 'same-day' ? 'bg-blue-100' :
        showAvailability && availability === 'normal' ? 'bg-slate-100' :
        showPrintoutNotification ? 'bg-red-100' : '';

    const notificationBridgeColor = bottomNotificationColor;

    return (
        <div
            data-sticky-add-to-cart-bar
            data-agent-summary="sticky_add_to_cart"
            data-availability-class={availability}
            data-lead-time-label={availability === 'rush' ? 'Ready in 60 minutes' : availability === 'same-day' ? 'Ready in 3 hours' : availability === 'normal' ? 'Requires advance lead time' : undefined}
            data-price={price ?? undefined}
            className={`fixed bottom-0 left-0 right-0 z-90 pointer-events-none transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'} ${className || ''}`}
        >
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {statusAnnouncement}
            </p>
            {errorAnnouncement ? (
                <p className="sr-only" role="alert" aria-atomic="true">
                    {errorAnnouncement}
                </p>
            ) : null}
            <div className={`pointer-events-auto transition-all duration-300 max-w-4xl mx-auto w-full ${isBlurred ? 'blur-[2px] opacity-50 pointer-events-none' : ''}`}>
                {/* Printout conversion stays in normal flow so availability cannot paint over it. */}
                <div className={`relative z-0 grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${showPrintoutNotification ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div
                        data-printout-wrapper
                        className="relative overflow-visible"
                    >
                        {renderPrintoutNotification()}
                    </div>
                </div>

                {/* Top Section: Warnings & Availability */}
                <div className={`relative z-0 grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${showAvailability ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div
                        data-availability-wrapper
                        className="relative overflow-visible"
                        style={showAvailability ? { marginBottom: `-${STICKY_ADD_TO_CART_AVAILABILITY_OVERLAP_PX}px` } : undefined}
                    >
                        {renderAvailabilityNotification()}
                    </div>
                </div>
                {/* Bridge: 16px of matching color outside overflow-hidden, fills the transparent
                    rounded-corner area at the top of the main bar (border-radius = 1rem = 16px) */}
                <div className={`h-4 rounded-t-2xl transition-opacity duration-500 ease-in-out ${hasTopNotification ? 'opacity-100' : 'opacity-0'} ${notificationBridgeColor}`} />

                {/* Bottom Section: Main Action Bar */}
                <div className={`relative z-10 bg-white/80 backdrop-blur-lg px-3 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] rounded-t-2xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] ${hasTopNotification ? 'border-t border-transparent' : 'border-t border-slate-200'} transition-all duration-300`}>
                    <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                        <div className="min-w-[80px] min-h-[48px] flex items-center">
                            <div className="relative">
                                {renderPrice()}
                                {isMounted && price !== null && !isAnalyzing && !isLoading && !error && !isDiscountApplied && (
                                    <DiscountOfferBubble 
                                        basePrice={price} 
                                        onApplied={() => setIsDiscountApplied(true)}
                                        notificationCount={Number(showPrintoutNotification) + Number(showAvailability)}
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
                                onClick={() => {
                                    if (addToCartBlockReason) {
                                        onAddToCartBlockedClick?.(addToCartBlockReason);
                                        return;
                                    }
                                    onAddToCartClick();
                                }}
                                title={addToCartDisabledReason}
                                aria-label={addToCartDisabledReason || 'Add this cake to cart'}
                                aria-disabled={Boolean(addToCartBlockReason)}
                                className={`flex-1 min-w-0 h-12 max-md:min-h-[44px] genie-btn-primary font-bold py-3 px-4 rounded-xl text-sm whitespace-nowrap ${addToCartBlockReason ? 'opacity-50 cursor-not-allowed shadow-md' : ''}`}
                            >
                                {isAdding ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> {!isCompact && 'Processing...'}</>
                                ) : (
                                    <>
                                        <ShoppingBag className="w-5 h-5 shrink-0" />
                                        {!isCompact && 'Add to Cart'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    {addToCartDisabledReason && (
                        <p className="mt-2 text-center text-[10px] max-md:text-[9px] font-medium text-slate-500 sm:hidden">
                            {addToCartDisabledReason}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
});

StickyAddToCartBar.displayName = 'StickyAddToCartBar';

export default StickyAddToCartBar;
