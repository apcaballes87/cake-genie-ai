'use client';
import React from 'react';
import { Loader2, AlertTriangleIcon, CartIcon } from './icons';
import { X, ShieldCheck } from 'lucide-react';
import { ShareButton } from './ShareButton';
import { CakeInfoUI } from '@/types';
import { AvailabilityType } from '@/lib/utils/availability';
import { ColorPalette } from './ColorPalette';
import type { CustomizingAiPromptSuggestionItem } from '@/app/customizing/CustomizingAiChatPanel';
import type { ParsedAiChatPromptTemplate } from '@/utils/aiChatPromptComposer';

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
    // Autocomplete
    showAiPromptSuggestions?: boolean;
    filteredAiChatPromptSuggestions?: CustomizingAiPromptSuggestionItem[];
    selectedAiPromptIndex?: number;
    onSuggestionSelect?: (suggestion: string) => void;
    onInputInteract?: () => void;
    onInputKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    containerRef?: React.RefObject<HTMLDivElement | null>;
    inputRef?: React.RefObject<HTMLTextAreaElement | null>;
    // Template / Color picker
    selectedAiPromptTemplate?: ParsedAiChatPromptTemplate | null;
    selectedAiPromptColor?: string;
    showAiPromptColorPicker?: boolean;
    onTemplateColorPickerToggle?: () => void;
    onTemplateClear?: () => void;
    onTemplateColorChange?: (color: string) => void | Promise<void>;
    hideAiChat?: boolean;
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
    showAiPromptSuggestions = false,
    filteredAiChatPromptSuggestions = [],
    selectedAiPromptIndex = -1,
    onSuggestionSelect,
    onInputInteract,
    onInputKeyDown,
    containerRef,
    inputRef,
    selectedAiPromptTemplate = null,
    selectedAiPromptColor = '',
    showAiPromptColorPicker = false,
    onTemplateColorPickerToggle,
    onTemplateClear,
    onTemplateColorChange,
    hideAiChat = false,
}) => {
    const show = Boolean(price !== null || error || isAnalyzing || warningMessage || hasPendingDesignChanges || isApplyingChanges || availability);

    const showAvailability = Boolean(availability && !isAnalyzing && !error);


    const [isCompact, setIsCompact] = React.useState(false);
    const buttonsRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const currentRef = buttonsRef.current;
        if (!currentRef) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // If width is less than ~230px, we switch to compact mode
                // This value is based on: Share Button (~90px) + "Add to Cart" (~130px) + Gap (12px)
                setIsCompact(entry.contentRect.width < 230);
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
        // Priority 1: Warning Message (Toy availability, replacements, etc.)
        if (warningMessage) {
            return (
                <div
                    className={`bg-red-50 rounded-t-2xl group relative transition-colors ${onWarningClick ? 'cursor-pointer hover:bg-red-100' : ''}`}
                    onClick={onWarningClick}
                >
                    <div className={`max-w-4xl mx-auto flex items-center justify-center gap-2 text-red-800 text-[10px] sm:text-[11px] font-bold p-1 ${!onWarningClick ? 'cursor-help' : ''}`}>
                        <AlertTriangleIcon className="w-5 h-5 text-red-600 shrink-0" />
                        <span>{warningMessage}</span>
                    </div>
                    {/* Tooltip */}
                    {warningDescription && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 text-center font-normal leading-relaxed pointer-events-none">
                            {warningDescription}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                    )}
                </div>
            );
        }

        // Priority 2: Order Availability
        if (!availability) return null;

        if (availability === 'rush') {
            return (
                <div className="bg-green-100 rounded-t-2xl">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-green-800 text-[10px] sm:text-[11px] font-bold p-1">
                        <span>⚡</span>
                        <span>Rush Order Available! Ready in 30 mins</span>
                    </div>
                </div>
            );
        }
        if (availability === 'same-day') {
            return (
                <div className="bg-blue-100 rounded-t-2xl">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-blue-800 text-[10px] sm:text-[11px] font-bold p-1">
                        <span>🕐</span>
                        <span>Same-Day Order! Ready in 3 hours</span>
                    </div>
                </div>
            );
        }
        if (availability === 'normal') {
            return (
                <div className="bg-slate-100 rounded-t-2xl">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-slate-700 text-[10px] sm:text-[11px] font-bold p-1">
                        <span>📅</span>
                        <span>Standard order. Requires 1-day lead time</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Bridge color matches the active notification — rendered outside overflow-hidden so it
    // fills the transparent rounded-corner area at the top of the main bar below.
    const notificationBridgeColor =
        warningMessage ? 'bg-red-50' :
        availability === 'rush' ? 'bg-green-100' :
        availability === 'same-day' ? 'bg-blue-100' :
        availability === 'normal' ? 'bg-slate-100' : '';

    return (
        <>
            {/* Top Section: Warnings & Availability (z-60) */}
            <div className={`fixed bottom-0 left-0 right-0 z-85 pointer-events-none transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'} ${className || ''}`}>
                <div className={`pointer-events-auto transition-all duration-300 ${isAnalyzing ? 'blur-[2px] opacity-50 pointer-events-none' : ''}`}>
                    <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${(!error && (warningMessage || (showAvailability && availability))) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="rounded-t-2xl relative overflow-hidden">
                            {renderAvailabilityNotification()}
                        </div>
                    </div>
                    {/* Bridge: 14px of matching color outside overflow-hidden, fills the transparent
                        rounded-corner area at the top of the main bar (border-radius = 1rem = 16px) */}
                    <div className={`h-[14px] transition-opacity duration-500 ease-in-out ${(!error && (warningMessage || (showAvailability && availability))) ? 'opacity-100' : 'opacity-0'} ${notificationBridgeColor}`} />
                </div>
                {/* Spacer: 114px + 14px bridge above = 128px total gap above the main bar */}
                <div className="h-[114px]" />
            </div>

            {/* Bottom Section: Main Action Bar (z-90) */}
            <div className={`fixed bottom-0 left-0 right-0 z-90 pointer-events-none transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'} ${className || ''}`}>
                <div className={`relative pointer-events-auto bg-white/80 backdrop-blur-lg px-3 pt-3 pb-[20px] rounded-t-2xl shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200 transition-all duration-300 ${isAnalyzing ? 'blur-[2px] opacity-50 pointer-events-none' : ''}`}>
                    {!hideAiChat && (
                        <div className="max-w-4xl mx-auto mb-2 relative bg-white border border-slate-200 rounded-2xl p-0 shadow-inner transition-all" ref={containerRef}>
                        {showAiPromptSuggestions && filteredAiChatPromptSuggestions.length > 0 && !isAiProcessing && !isApplyingChanges && (
                            <div className="absolute left-0 right-0 bottom-full mb-3 z-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="max-h-35 overflow-y-auto py-1">
                                    {filteredAiChatPromptSuggestions.map(({ suggestion, template }, index) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            onMouseDown={(event) => {
                                                // Prevent input focus loss
                                                event.preventDefault();
                                            }}
                                            onClick={() => onSuggestionSelect?.(suggestion)}
                                            className={`block w-full px-4 py-1 text-left text-[11px] transition-colors cursor-pointer active:bg-purple-100 ${selectedAiPromptIndex === index ? 'bg-purple-50 text-purple-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                                            aria-label={`Select suggestion: ${suggestion}`}
                                        >
                                            {template ? (
                                                <span className="wrap-break-word">
                                                    {template.prefix}
                                                    <span className="mx-1 inline-flex rounded-full bg-purple-50 px-2 py-0.5 font-bold text-purple-700">
                                                        {template.placeholderLabel}
                                                    </span>
                                                    {template.suffix}
                                                </span>
                                            ) : suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {selectedAiPromptTemplate ? (
                            <div className="py-2 px-3 pr-10">
                                <div className="flex items-start gap-2 text-[14px] leading-6 text-slate-700">
                                    <span className="min-w-0 flex-1 wrap-break-word">
                                        {selectedAiPromptTemplate?.prefix}
                                        <button
                                            type="button"
                                            onClick={onTemplateColorPickerToggle}
                                            className="mx-1 inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 font-bold text-purple-700 underline decoration-purple-300 underline-offset-2 transition hover:bg-purple-100"
                                            aria-label={`Pick ${selectedAiPromptTemplate?.placeholderLabel}`}
                                        >
                                            {selectedAiPromptTemplate?.placeholderLabel}
                                        </button>
                                        {selectedAiPromptTemplate?.suffix}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={onTemplateClear}
                                        className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                        aria-label="Edit prompt as text"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                {showAiPromptColorPicker && (
                                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
                                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 px-1">
                                            Choose {selectedAiPromptTemplate?.placeholderLabel}
                                        </div>
                                        <ColorPalette
                                            selectedColor={selectedAiPromptColor}
                                            onColorChange={(color) => { void onTemplateColorChange?.(color); }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative flex items-center">
                                <textarea
                                    ref={inputRef}
                                    placeholder="✨ Tell Genie your cake design wish..."
                                    className="bg-transparent border-none outline-none resize-none px-3 py-2.5 pr-12 text-slate-700 w-full text-[14px] font-medium placeholder:text-slate-500/60 leading-normal"
                                    rows={1}
                                    value={chatInput}
                                    onFocus={onInputInteract}
                                    onClick={onInputInteract}
                                    onChange={(e) => {
                                        onChatInputChange?.(e.target.value);
                                        // Auto-resize
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        // Let the autocomplete handler run first (keys like Up/Down/Enter/Escape)
                                        if (onInputKeyDown) {
                                            onInputKeyDown(e);
                                        }
                                        // If it wasn't handled (e.defaultPrevented), and it's Enter, then submit
                                        if (!e.defaultPrevented && e.key === 'Enter' && !e.shiftKey) {
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
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 bg-linear-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white transition-all flex items-center justify-center rounded-xl disabled:opacity-40 disabled:cursor-not-allowed group"
                                    aria-label="Submit AI Edit"
                                >
                                    {isAiProcessing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                        >
                                            <line x1="22" y1="2" x2="11" y2="13"></line>
                                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    )}
                    <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                        <div className="min-w-[100px] min-h-[44px] flex items-center relative">
                            {renderPrice()}
                        </div>
                        <div className="flex flex-1 gap-3 min-w-0" ref={buttonsRef}>
                            <ShareButton
                                onClick={onShareClick}
                                isLoading={isSharing}
                                disabled={!canShare || isApplyingChanges}
                                className="flex-1 min-w-0"
                                showText={!isCompact}
                            />
                            <button
                                onClick={onAddToCartClick}
                                disabled={isLoading || !!error || price === null || isAdding || isAnalyzing || chatInput.trim().length > 0}
                                className={`flex-1 min-w-0 bg-linear-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex justify-center items-center gap-2 whitespace-nowrap ${chatInput.trim().length > 0 ? 'opacity-40 grayscale-[0.5]' : ''}`}
                            >
                                {isAdding ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> {!isCompact && 'Adding...'}</>
                                ) : (
                                    <>
                                        <CartIcon className="w-5 h-5 shrink-0" />
                                        {!isCompact && 'Add to Cart'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
});

StickyAddToCartBar.displayName = 'StickyAddToCartBar';

export default StickyAddToCartBar;