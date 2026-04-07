'use client';

import React, { memo, useMemo } from 'react';
import { X } from 'lucide-react';
import LazyImage from '@/components/LazyImage';
import { ColorPalette } from '@/components/ColorPalette';
import { ResetIcon } from '@/components/icons';
import { findClosestColor } from '@/utils/colorUtils';
import type { CakeType, ClusteredMarker, IcingColorDetails, IcingDesignUI, MainTopperUI } from '@/types';

type IcingImageType = 'top' | 'side' | 'drip' | 'borderTop' | 'borderBase' | 'gumpasteBaseBoard';

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
}

const defaultIcingDesign: IcingDesignUI = {
    base: 'soft_icing',
    color_type: 'single',
    drip: false,
    border_top: false,
    border_base: false,
    colors: { top: '#FFFFFF', side: '#FFFFFF' },
    gumpasteBaseBoard: false,
    dripPrice: 0,
    gumpasteBaseBoardPrice: 0,
};

const getIcingImage = (icingDesign: IcingDesignUI, type: IcingImageType, isTopSpecific = false): string => {
    const baseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';
    let color: string | undefined;
    let prefix = 'icing';
    let defaultFile = 'icing_white.webp';

    switch (type) {
        case 'top':
            color = icingDesign.colors?.top;
            if (isTopSpecific) {
                prefix = 'topicing';
                defaultFile = 'topicing_white.webp';
            }
            break;
        case 'side':
            color = icingDesign.colors?.side;
            break;
        case 'drip':
            color = icingDesign.colors?.drip;
            prefix = 'drip';
            defaultFile = 'drip_white.webp';
            break;
        case 'borderTop':
            color = icingDesign.colors?.borderTop;
            prefix = 'top';
            defaultFile = 'top_white.webp';
            break;
        case 'borderBase':
            color = icingDesign.colors?.borderBase;
            prefix = 'baseborder';
            defaultFile = 'baseborder_white.webp';
            break;
        case 'gumpasteBaseBoard':
            color = icingDesign.colors?.gumpasteBaseBoardColor;
            prefix = 'baseboard';
            defaultFile = 'baseboardwhite.webp';
            break;
    }

    if (!color) return baseUrl + defaultFile;
    return `${baseUrl}${prefix}${prefix === 'baseboard' ? '' : '_'}${findClosestColor(color)}.webp`;
};

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
}: Pick<CustomizingIcingEditorPanelProps, 'icingDesign' | 'cakeType' | 'selectedItem' | 'mainToppers' | 'onSelectItem'> & { isVisible: boolean }) {
    const isBento = cakeType === 'Bento';
    const hasEdiblePhotoOnTop = mainToppers.some((topper) => topper.isEnabled && topper.type === 'edible_photo_top');
    const effectiveIcingDesign = icingDesign || defaultIcingDesign;
    const effectiveCakeType = cakeType || '1 Tier';
    const topColor = effectiveIcingDesign.colors?.top;
    const sideColor = effectiveIcingDesign.colors?.side;
    const icingColorsSame = topColor && sideColor && topColor.toUpperCase() === sideColor.toUpperCase();

    const tools = useMemo(() => (icingColorsSame ? [
        { id: 'drip', description: 'Drip', label: 'Drip', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'drip')} alt="Cake drip icing effect" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.drip },
        { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'borderTop')} alt="Cake top border icing" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_top },
        { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'borderBase')} alt="Cake base border icing" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
        { id: 'icing', description: 'Body Icing', label: 'Body Icing', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'top')} alt="Cake icing color" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: !!(effectiveIcingDesign.colors?.top || effectiveIcingDesign.colors?.side) },
        { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'gumpasteBaseBoard')} alt="Cake gumpaste baseboard" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
    ] : [
        { id: 'drip', description: 'Drip', label: 'Drip', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'drip')} alt="Cake drip icing effect" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.drip },
        { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'borderTop')} alt="Cake top border icing" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_top },
        { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'borderBase')} alt="Cake base border icing" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
        { id: 'top', description: 'Top Icing', label: 'Top Icing', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'top', true)} alt="Cake top icing design" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: !!effectiveIcingDesign.colors?.top },
        { id: 'side', description: 'Side Icing', label: 'Body Icing', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'side')} alt="Cake side icing design" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: !!effectiveIcingDesign.colors?.side },
        { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <LazyImage src={getIcingImage(effectiveIcingDesign, 'gumpasteBaseBoard')} alt="Cake gumpaste baseboard" width={48} height={48} containerClassName="w-full h-full flex items-center justify-center" imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
    ]).filter((tool) => !(tool.id === 'top' && hasEdiblePhotoOnTop)), [effectiveIcingDesign, hasEdiblePhotoOnTop, icingColorsSame, isBento]);

    return (
        <div className={`flex flex-row flex-wrap gap-3 justify-center transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {tools.map((tool) => {
                const isSelected = selectedItem?.id === `icing-edit-${tool.id}`;
                const buttonSizeClasses = tools.length === 6
                    ? 'w-12 h-12 max-[465px]:w-10 max-[465px]:h-10'
                    : tools.length === 5
                        ? 'w-12 h-12 max-[400px]:w-10 max-[400px]:h-10'
                        : 'w-12 h-12';

                return (
                    <div key={tool.id} className="flex flex-col items-center gap-1 group">
                        <button
                            type="button"
                            aria-label={tool.label}
                            onClick={() => {
                                if (tool.disabled) return;
                                onSelectItem(isSelected ? null : { id: `icing-edit-${tool.id}`, itemCategory: 'icing', description: tool.description, cakeType: effectiveCakeType });
                            }}
                            className={`relative ${buttonSizeClasses} p-2 rounded-full hover:bg-purple-100 transition-all ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-white/80'} backdrop-blur-md ${tool.featureFlag ? 'border-2 border-purple-600' : 'border border-slate-200'} shadow-md ${tool.featureFlag ? '' : 'opacity-60'} disabled:opacity-40 disabled:cursor-not-allowed`}
                            disabled={tool.disabled}
                        >
                            {React.cloneElement(tool.icon as React.ReactElement<{ className?: string }>, { className: 'w-full h-full flex items-center justify-center' })}
                            {tool.disabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                                    <X className="w-6 h-6 text-white" />
                                </div>
                            )}
                        </button>
                        <span className={`text-[10px] font-medium transition-colors whitespace-nowrap ${isSelected ? 'text-purple-600' : 'text-slate-600 group-hover:text-purple-600'} ${tool.disabled ? 'opacity-40' : ''}`}>
                            {tool.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
});

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
}: CustomizingIcingEditorPanelProps) {
    const selectedIcingItem = isIcingSelection(selectedItem) ? selectedItem : null;
    const isBento = cakeType === 'Bento';

    const renderToggleAndColor = (featureKey: 'drip' | 'border_top' | 'border_base' | 'gumpasteBaseBoard', colorKey: keyof IcingColorDetails, label: string) => {
        if (!icingDesign) return null;
        const isEnabled = icingDesign[featureKey];
        const isDisabled = (featureKey === 'border_base' || featureKey === 'gumpasteBaseBoard') && isBento;

        return (
            <>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">{label}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            aria-label={label}
                            className="sr-only peer"
                            checked={isEnabled || false}
                            disabled={isDisabled}
                            onChange={(event) => {
                                const nextDesign = { ...icingDesign, [featureKey]: event.target.checked };
                                if (event.target.checked && !nextDesign.colors[colorKey]) {
                                    nextDesign.colors = { ...nextDesign.colors, [colorKey]: '#FFFFFF' };
                                }
                                onIcingDesignChange(nextDesign);
                            }}
                        />
                        <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'peer-checked:bg-purple-600'}`} />
                    </label>
                </div>
                <div className={`transition-all duration-300 ${isDisabled ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-24 opacity-100'}`}>
                    <div className={`pb-2 transition-all duration-200 ${!isEnabled ? 'opacity-40 pointer-events-auto' : ''}`}>
                        <ColorPalette
                            selectedColor={icingDesign.colors[colorKey] || ''}
                            onColorChange={(newHex) => {
                                onIcingDesignChange({
                                    ...icingDesign,
                                    [featureKey]: true,
                                    colors: { ...icingDesign.colors, [colorKey]: newHex },
                                });
                            }}
                        />
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500">Customize your cake&apos;s colors and icing details.</p>
                    {hasIcingChanges && (
                        <button type="button" onClick={onRevert} className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1">
                            <ResetIcon className="w-3 h-3" />
                            Revert
                        </button>
                    )}
                </div>
                <IcingToolbar
                    onSelectItem={onSelectItem}
                    icingDesign={icingDesign}
                    cakeType={cakeType}
                    isVisible={isVisible}
                    selectedItem={selectedItem}
                    mainToppers={mainToppers}
                />
                {selectedIcingItem && (
                    <div className="mt-2 pt-2 border-t border-slate-100 animate-fade-in">
                        {selectedIcingItem.description === 'Drip' && renderToggleAndColor('drip', 'drip', 'Drip Effect')}
                        {selectedIcingItem.description === 'Top' && renderToggleAndColor('border_top', 'borderTop', 'Top Border')}
                        {selectedIcingItem.description === 'Bottom' && renderToggleAndColor('border_base', 'borderBase', 'Base Border')}
                        {selectedIcingItem.description === 'Board' && renderToggleAndColor('gumpasteBaseBoard', 'gumpasteBaseBoardColor', 'Covered Board')}
                        {selectedIcingItem.description === 'Body Icing' && icingDesign && (
                            <div className="pb-2">
                                <ColorPalette
                                    selectedColor={icingDesign.colors.top || icingDesign.colors.side || '#FFFFFF'}
                                    onColorChange={(newHex) => {
                                        onIcingDesignChange({
                                            ...icingDesign,
                                            colors: { ...icingDesign.colors, top: newHex, side: newHex },
                                        });
                                    }}
                                />
                            </div>
                        )}
                        {selectedIcingItem.description === 'Top Icing' && icingDesign && (
                            <div className="pb-2">
                                <ColorPalette
                                    selectedColor={icingDesign.colors.top || ''}
                                    onColorChange={(newHex) => onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, top: newHex } })}
                                />
                            </div>
                        )}
                        {selectedIcingItem.description === 'Side Icing' && icingDesign && (
                            <div className="pb-2">
                                <ColorPalette
                                    selectedColor={icingDesign.colors.side || ''}
                                    onColorChange={(newHex) => onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, side: newHex } })}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

CustomizingIcingEditorPanel.displayName = 'CustomizingIcingEditorPanel';