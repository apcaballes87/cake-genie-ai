'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { AiChatQuickActionMode, AiChatTopperMaterialAction } from './aiChatQuickActions';

interface CakeDesignQuickActionsProps {
    mode: AiChatQuickActionMode;
    selectedAction?: AiChatTopperMaterialAction | null;
    priceDeltas?: Partial<Record<AiChatTopperMaterialAction, number | null>>;
    isDisabled?: boolean;
    isPhotoUploading?: boolean;
    onEdiblePhotoUpload?: (file: File) => void | Promise<void>;
    onTopperMaterialAction?: (action: AiChatTopperMaterialAction) => void;
    onOpenToppers?: () => void;
}

export const CakeDesignQuickActions = React.memo(({
    mode,
    selectedAction = null,
    priceDeltas,
    isDisabled = false,
    isPhotoUploading = false,
    onEdiblePhotoUpload,
    onTopperMaterialAction,
    onOpenToppers,
}: CakeDesignQuickActionsProps) => {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const isActionDisabled = isDisabled || isPhotoUploading;
    const controlBaseClassName = 'min-h-[32px] max-md:min-h-[34px] flex items-center justify-center px-2.5 py-0.5 rounded-xl border transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50';
    const getMaterialButtonClassName = (action: AiChatTopperMaterialAction) => selectedAction === action
        ? 'genie-control-selected text-purple-700 scale-[1.02]'
        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50';
    const getPriceDeltaLabel = (action: AiChatTopperMaterialAction) => {
        const priceDelta = priceDeltas?.[action];
        if (typeof priceDelta !== 'number' || !Number.isFinite(priceDelta) || priceDelta === 0) return null;
        return `${priceDelta > 0 ? '+' : '-'}₱${Math.abs(priceDelta).toLocaleString()}`;
    };

    if (!mode) return null;

    return (
        <div className="flex w-full flex-col gap-1" aria-label="Cake design quick actions">
            <span className="text-[10px] max-md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Topper Types
            </span>
            <div className="flex w-full items-center gap-1.5">
                {mode === 'edible-photo' ? (
                <>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label="Choose image for edible photo"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                                void onEdiblePhotoUpload?.(file);
                            }
                            event.target.value = '';
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isActionDisabled}
                        className={`${controlBaseClassName} w-full text-[9px] max-md:text-[8px] font-bold border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50`}
                    >
                        Upload Image for Edible Photo
                    </button>
                </>
                ) : (
                <>
                    <div className="flex min-w-0 flex-1 gap-1.5">
                        {mode === 'toy-toppers' && (
                            <button
                                type="button"
                                onClick={() => onTopperMaterialAction?.('toy')}
                                disabled={isActionDisabled}
                                aria-pressed={selectedAction === 'toy'}
                                className={`${controlBaseClassName} min-w-0 flex-1 flex-wrap content-center gap-x-1 gap-y-0 text-[9px] max-md:text-[8px] font-bold ${getMaterialButtonClassName('toy')}`}
                            >
                                <span className="whitespace-nowrap leading-tight">All Toys</span>
                                {getPriceDeltaLabel('toy') && (
                                    <span className={`whitespace-nowrap text-[8px] max-md:text-[7px] font-bold leading-tight ${priceDeltas?.toy && priceDeltas.toy > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {getPriceDeltaLabel('toy')}
                                    </span>
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onTopperMaterialAction?.('edible')}
                            disabled={isActionDisabled}
                            aria-pressed={selectedAction === 'edible'}
                            className={`${controlBaseClassName} min-w-0 flex-1 flex-wrap content-center gap-x-1 gap-y-0 text-[9px] max-md:text-[8px] font-bold ${getMaterialButtonClassName('edible')}`}
                        >
                            <span className="whitespace-nowrap leading-tight">All Edible Toppers</span>
                            {getPriceDeltaLabel('edible') && (
                                <span className={`whitespace-nowrap text-[8px] max-md:text-[7px] font-bold leading-tight ${priceDeltas?.edible && priceDeltas.edible > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {getPriceDeltaLabel('edible')}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => onTopperMaterialAction?.('printout')}
                            disabled={isActionDisabled}
                            aria-pressed={selectedAction === 'printout'}
                            className={`${controlBaseClassName} min-w-0 flex-1 flex-wrap content-center gap-x-1 gap-y-0 text-[9px] max-md:text-[8px] font-bold ${getMaterialButtonClassName('printout')}`}
                        >
                            <span className="whitespace-nowrap leading-tight">All Printout</span>
                            {getPriceDeltaLabel('printout') && (
                                <span className={`whitespace-nowrap text-[8px] max-md:text-[7px] font-bold leading-tight ${priceDeltas?.printout && priceDeltas.printout > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {getPriceDeltaLabel('printout')}
                                </span>
                            )}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenToppers}
                        disabled={isActionDisabled}
                        aria-label="Open toppers bottom sheet"
                        className={`${controlBaseClassName} w-9 shrink-0 text-slate-600 border-slate-200 bg-slate-50 hover:border-purple-200 hover:bg-slate-100/50 hover:text-purple-700`}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </>
                )}
            </div>
        </div>
    );
});

CakeDesignQuickActions.displayName = 'CakeDesignQuickActions';
