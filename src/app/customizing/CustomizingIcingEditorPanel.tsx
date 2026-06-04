'use client';

import React, { memo, useMemo } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import LazyImage from '@/components/LazyImage';
import { ColorPalette } from '@/components/ColorPalette';
import MagicGlitter from '@/components/MagicGlitter';
import { ResetIcon } from '@/components/icons';
import { DEFAULT_ICING_DESIGN } from '@/constants';
import { getIcingBucketName } from '@/utils/colorUtils';
import { getIcingImage, type IcingImageType } from '@/utils/icingImage';
import type { CakeType, ClusteredMarker, IcingColorDetails, IcingDesign, IcingDesignUI, IcingGroup, MainTopperUI } from '@/types';

interface CustomizingIcingEditorPanelProps {
    isVisible: boolean;
    hasIcingChanges: boolean;
    icingDesign: IcingDesignUI | null;
    cakeType: CakeType | null;
    selectedItem: ClusteredMarker | null;
    mainToppers: MainTopperUI[];
    onSelectItem: (item: ClusteredMarker | null) => void;
    onIcingDesignChange: (nextDesign: IcingDesignUI) => void;
    onRevert: () => void;
    /**
     * Optional mask-based instant recolor action. When provided, the Body/Top/Side
     * icing color circles call this (in addition to updating icing design state) so
     * the displayed image is recolored client-side without a Gemini round trip.
     * The icing design state still updates via onIcingDesignChange to keep the data
     * model (icingDesign.colors.top/side) in sync — this only changes the image.
     */
    onIcingColorRecolor?: (hex: string, name: string) => void;
    /**
     * When true, a loading spinner is shown over the affected icing color group while
     * the one-time mask is generated. All other controls stay enabled and responsive.
     */
    isGeneratingMask?: boolean;
    isStudioBackgroundEditingPending?: boolean;
    /**
     * Current mask lifecycle status. Surfaced to the user as an error banner when
     * `error` so they're not stuck wondering why a recolor isn't applying.
     */
    maskStatus?: 'idle' | 'generating' | 'ready' | 'error';
    /**
     * Optional mask on/off toggle. When provided, a small toggle button is shown
     * next to Revert, mirroring the sidebar's "Icing" toggle. Re-clicking the
     * analyzed default color routes through this handler so the toggle and the
     * displayed image stay in sync.
     */
    onToggleMask?: () => void;
    isMaskActive?: boolean;
}

// Display labels per group. The Side Icing tool keeps the user-facing label
// "Body Icing" to match the rest of the UI's vocabulary; the internal group
// name is the descriptive "side".
const GROUP_LABEL: Record<IcingGroup, string> = {
    drip: 'Drip Effect',
    top: 'Top Icing',
    side: 'Body Icing',
    borderTop: 'Top Border',
    borderBase: 'Base Border',
    gumpasteBaseBoard: 'Covered Board',
};

const GROUP_FEATURE_KEY = {
    drip: 'drip',
    borderTop: 'border_top',
    borderBase: 'border_base',
    gumpasteBaseBoard: 'gumpasteBaseBoard',
} as const satisfies Partial<Record<IcingGroup, keyof IcingDesignUI>>;

type ToggleGroup = 'drip' | 'borderTop' | 'borderBase' | 'gumpasteBaseBoard';
const TOGGLE_GROUPS = new Set<IcingGroup>(['drip', 'borderTop', 'borderBase', 'gumpasteBaseBoard']);

const GROUP_COLOR_KEYS: Record<IcingGroup, Array<keyof IcingColorDetails>> = {
    drip: ['drip'],
    top: ['top'],
    side: ['side'],
    borderTop: ['borderTop'],
    borderBase: ['borderBase'],
    gumpasteBaseBoard: ['gumpasteBaseBoardColor'],
};

const IcingThumb = memo(function IcingThumb({
    type,
    design,
    isTopSpecific,
}: {
    type: IcingImageType;
    design: IcingDesignUI;
    isTopSpecific?: boolean;
}) {
    return (
        <LazyImage
            src={getIcingImage(design, type, isTopSpecific)}
            alt={`Icing ${type}`}
            width={48}
            height={48}
            containerClassName="w-full h-full flex items-center justify-center"
            imageClassName="w-full h-full object-contain"
            unoptimized
        />
    );
});

const isIcingSelection = (item: ClusteredMarker | null): item is Extract<ClusteredMarker, { itemCategory: 'icing' }> => (
    !!item && 'itemCategory' in item && item.itemCategory === 'icing'
);

const IcingToolbar = memo(function IcingToolbar({
    onSelectItem,
    icingDesign,
    cakeType,
    isVisible,
    selectedItem,
    mainToppers,
    isGeneratingMask = false,
    isBusy = false,
}: Pick<CustomizingIcingEditorPanelProps, 'icingDesign' | 'cakeType' | 'selectedItem' | 'mainToppers' | 'onSelectItem' | 'isGeneratingMask'> & { isVisible: boolean; isBusy?: boolean }) {
    const isBento = cakeType === 'Bento';
    const hasEdiblePhotoOnTop = mainToppers.some((topper) => topper.isEnabled && topper.type === 'edible_photo_top');
    const effectiveIcingDesign = icingDesign || DEFAULT_ICING_DESIGN;
    const effectiveCakeType = cakeType || '1 Tier';

    const tools = useMemo(() => [
        { group: 'drip' as const,              label: 'Drip',       icon: <IcingThumb type="drip"              design={effectiveIcingDesign} />, featureFlag: effectiveIcingDesign.drip,              disabled: false },
        { group: 'borderTop' as const,         label: 'Top Border', icon: <IcingThumb type="borderTop"         design={effectiveIcingDesign} />, featureFlag: effectiveIcingDesign.border_top,         disabled: false },
        { group: 'borderBase' as const,        label: 'Base Border',icon: <IcingThumb type="borderBase"        design={effectiveIcingDesign} />, featureFlag: effectiveIcingDesign.border_base,        disabled: isBento },
        { group: 'top' as const,               label: 'Top Icing',  icon: <IcingThumb type="top" isTopSpecific design={effectiveIcingDesign} />, featureFlag: !!effectiveIcingDesign.colors?.top,   disabled: false },
        { group: 'side' as const,              label: 'Body Icing', icon: <IcingThumb type="side"              design={effectiveIcingDesign} />, featureFlag: !!effectiveIcingDesign.colors?.side,  disabled: false },
        { group: 'gumpasteBaseBoard' as const, label: 'Board',      icon: <IcingThumb type="gumpasteBaseBoard" design={effectiveIcingDesign} />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
    ].filter((tool) => !(tool.group === 'top' && hasEdiblePhotoOnTop)), [effectiveIcingDesign, hasEdiblePhotoOnTop, isBento]);

    return (
        <div className={`flex flex-col items-center gap-2 transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="flex flex-row flex-wrap gap-3 justify-center">
            {tools.map((tool) => {
                const isSelected = selectedItem?.id === `icing-edit-${tool.group}`;
                const buttonSizeClasses = tools.length === 6
                    ? 'w-12 h-12 max-[465px]:w-10 max-[465px]:h-10'
                    : tools.length === 5
                        ? 'w-12 h-12 max-[400px]:w-10 max-[400px]:h-10'
                        : 'w-12 h-12';

                return (
                    <div key={tool.group} className="flex flex-col items-center gap-1 group">
                        <button
                            type="button"
                            aria-label={tool.label}
                            onClick={() => {
                                if (tool.disabled || isBusy) return;
                                onSelectItem(isSelected ? null : { id: `icing-edit-${tool.group}`, itemCategory: 'icing', description: tool.group, cakeType: effectiveCakeType });
                            }}
                            className={`relative ${buttonSizeClasses} p-2 rounded-full hover:bg-purple-100 transition-all ${isSelected ? 'genie-control-selected' : 'bg-white/80'} backdrop-blur-md ${tool.featureFlag ? 'border-2 border-purple-400' : 'border border-purple-100'} shadow-md ${tool.featureFlag ? '' : 'opacity-60'} disabled:opacity-40 disabled:cursor-not-allowed`}
                            disabled={tool.disabled || isBusy}
                        >
                            {React.cloneElement(tool.icon as React.ReactElement<{ className?: string }>, { className: 'w-full h-full flex items-center justify-center' })}
                            {tool.disabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                                    <X className="w-6 h-6 text-white" />
                                </div>
                            )}
                        </button>
                        <span className={`text-[10px] font-medium transition-colors whitespace-nowrap ${isSelected ? 'text-purple-700' : 'text-slate-600 group-hover:text-purple-600'} ${tool.disabled ? 'opacity-40' : ''}`}>
                            {tool.label}
                        </span>
                    </div>
                );
            })}
            </div>
            {/* Pulsing label shown while the AI icing mask is being generated */}
            <p
                className={`text-[10px] font-medium text-purple-600 tracking-wide text-center transition-opacity duration-700 ${
                    isGeneratingMask ? 'animate-pulse opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-live="polite"
                aria-label="Loading different icing colors"
            >
                Loading Different Icing Colors
            </p>
        </div>
    );
});

const VisibleStatusMessage = memo(function VisibleStatusMessage({
    isStudioBackgroundEditingPending,
    isGeneratingMask,
    maskStatus,
}: {
    isStudioBackgroundEditingPending: boolean;
    isGeneratingMask: boolean;
    maskStatus: 'idle' | 'generating' | 'ready' | 'error' | undefined;
}) {
    if (maskStatus === 'error') {
        return (
            <div className="mt-2.5 flex items-center justify-center gap-2 text-[9px] font-bold text-red-600 animate-pulse bg-red-50/50 py-1.5 px-3 rounded-lg border border-red-100/60 transition-all duration-300">
                <AlertCircle className="h-3 w-3" />
                <span>Recolor unavailable — retrying with AI…</span>
            </div>
        );
    }

    if (!isStudioBackgroundEditingPending && !isGeneratingMask) return null;

    const message = isStudioBackgroundEditingPending
        ? 'ai is editing your background...'
        : 'ai is editing your icing...';

    return (
        <div className="mt-2.5 flex items-center justify-center gap-2 text-[9px] font-bold text-purple-600 animate-pulse bg-purple-50/50 py-1.5 px-3 rounded-lg border border-purple-100/60 transition-all duration-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{message}</span>
        </div>
    );
});

const areIcingDesignsEqual = (a: IcingDesign, b: IcingDesign): boolean => {
    const aKeys: Array<keyof IcingColorDetails> = ['top', 'side', 'drip', 'borderTop', 'borderBase', 'gumpasteBaseBoardColor'];
    for (const key of aKeys) {
        if ((a.colors?.[key] || '') !== (b.colors?.[key] || '')) return false;
    }
    if (a.drip !== b.drip) return false;
    if (a.border_top !== b.border_top) return false;
    if (a.border_base !== b.border_base) return false;
    if (a.gumpasteBaseBoard !== b.gumpasteBaseBoard) return false;
    return true;
};

export const CustomizingIcingEditorPanel = memo(function CustomizingIcingEditorPanel({
    isVisible,
    hasIcingChanges,
    icingDesign,
    cakeType,
    selectedItem,
    mainToppers,
    onSelectItem,
    onIcingDesignChange,
    onRevert,
    onIcingColorRecolor,
    isGeneratingMask = false,
    isStudioBackgroundEditingPending = false,
    maskStatus = 'idle',
    onToggleMask,
    isMaskActive = false,
}: CustomizingIcingEditorPanelProps) {
    const selectedIcingItem = isIcingSelection(selectedItem) ? selectedItem : null;
    const isBento = cakeType === 'Bento';
    const isBusy = isStudioBackgroundEditingPending || isGeneratingMask || maskStatus === 'generating';

    const renderIcingColorGroup = (group: IcingGroup) => {
        if (!icingDesign) return null;
        const colorKeys = GROUP_COLOR_KEYS[group];
        const label = GROUP_LABEL[group];
        const isToggle = TOGGLE_GROUPS.has(group);
        const featureKey = GROUP_FEATURE_KEY[group as ToggleGroup] as 'drip' | 'border_top' | 'border_base' | 'gumpasteBaseBoard' | undefined;
        const isFeatureDisabled = !!featureKey && (featureKey === 'border_base' || featureKey === 'gumpasteBaseBoard') && isBento;
        const isEnabled = !featureKey ? true : !!icingDesign[featureKey];
        const selectedColor = colorKeys.map((k) => icingDesign.colors?.[k]).find((c): c is string => !!c) || '#FFFFFF';

        const applyColor = (newHex: string) => {
            const colors = { ...icingDesign.colors };
            for (const key of colorKeys) {
                colors[key] = newHex;
            }
            const nextDesign: IcingDesignUI = {
                ...icingDesign,
                ...(featureKey ? { [featureKey]: true } : {}),
                colors,
            };
            onIcingDesignChange(nextDesign);
            // Body / top / side groups drive the mask-based instant recolor.
            if (!isToggle && onIcingColorRecolor) {
                onIcingColorRecolor(newHex, getIcingBucketName(newHex));
            }
        };

        return (
            <div className="pb-2">
                {isToggle ? (
                    <>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-700">{label}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    aria-label={label}
                                    className="sr-only peer"
                                    checked={isEnabled}
                                    disabled={isFeatureDisabled || isBusy}
                                    onChange={(event) => {
                                        const nextDesign = { ...icingDesign, [featureKey!]: event.target.checked };
                                        if (event.target.checked) {
                                            const colors = { ...nextDesign.colors };
                                            for (const key of colorKeys) {
                                                if (!colors[key]) colors[key] = '#FFFFFF';
                                            }
                                            nextDesign.colors = colors;
                                        }
                                        onIcingDesignChange(nextDesign);
                                    }}
                                />
                                <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isFeatureDisabled ? 'opacity-50 cursor-not-allowed' : 'peer-checked:bg-purple-400'}`} />
                            </label>
                        </div>
                        <div className={`transition-all duration-300 ${isFeatureDisabled ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-24 opacity-100'}`}>
                            <div className={`pb-2 transition-all duration-200 ${!isEnabled ? 'opacity-40 pointer-events-auto' : ''}`}>
                                <ColorPalette
                                    selectedColor={selectedColor}
                                    onColorChange={applyColor}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="relative">
                        {isGeneratingMask && <MagicGlitter />}
                        <ColorPalette
                            selectedColor={selectedColor}
                            onColorChange={applyColor}
                            disabled={isBusy}
                        />
                    </div>
                )}
                <VisibleStatusMessage
                    isStudioBackgroundEditingPending={isStudioBackgroundEditingPending}
                    isGeneratingMask={isGeneratingMask}
                    maskStatus={maskStatus}
                />
            </div>
        );
    };

    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <div className="space-y-4">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                    <p className="text-xs text-slate-500">Customize your cake&apos;s colors and icing details.</p>
                    <div className="flex items-center gap-1.5">
                        {onToggleMask && (
                            <button
                                type="button"
                                onClick={onToggleMask}
                                aria-label={isMaskActive ? 'Turn off icing recolor' : 'Turn on icing recolor'}
                                title={isMaskActive ? 'Turn off icing recolor' : 'Turn on icing recolor'}
                                disabled={isBusy}
                                className="relative h-6 w-11 rounded-full shadow-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: isMaskActive ? (icingDesign?.colors?.side || icingDesign?.colors?.top || '#cbd5e1') : '#cbd5e1' }}
                            >
                                <span
                                    className="absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
                                    style={{ left: isMaskActive ? 'calc(100% - 22px)' : '2px' }}
                                />
                            </button>
                        )}
                        {hasIcingChanges && (
                            <button type="button" onClick={onRevert} className="genie-btn-ghost text-xs font-medium rounded-lg px-2 py-1">
                                <ResetIcon className="w-3 h-3" />
                                Revert
                            </button>
                        )}
                    </div>
                </div>
                <IcingToolbar
                    onSelectItem={onSelectItem}
                    icingDesign={icingDesign}
                    cakeType={cakeType}
                    isVisible={isVisible}
                    selectedItem={selectedItem}
                    mainToppers={mainToppers}
                    isGeneratingMask={isGeneratingMask}
                    isBusy={isBusy}
                />
                {selectedIcingItem && (
                    <div className="mt-2 pt-2 border-t border-slate-100 animate-fade-in">
                        {renderIcingColorGroup(selectedIcingItem.description)}
                    </div>
                )}
            </div>
        </div>
    );
});

CustomizingIcingEditorPanel.displayName = 'CustomizingIcingEditorPanel';

// Re-export the equality helper so the host (CustomizingClient) can decide
// whether the Revert button should be shown based on whether the current
// design differs from the last-committed design.
export { areIcingDesignsEqual };
