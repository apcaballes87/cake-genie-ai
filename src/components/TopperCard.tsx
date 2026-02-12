'use client';
import React, { useState, useRef } from 'react';
import { MainTopperUI, SupportElementUI, MainTopperType, SupportElementType } from '@/types';
import { PencilIcon, PhotoIcon, Loader2, ResetIcon } from './icons';
import { ColorPalette } from './ColorPalette';
import { MultiColorEditor } from './MultiColorEditor';

// Constants
export const topperTypeDisplayMap: Record<MainTopperType, string> = {
    'edible_3d_complex': 'Gumpaste (Complex)', 'edible_3d_ordinary': 'Gumpaste (Ordinary)', 'printout': 'Printout', 'edible_photo_top': 'Printout (Edible)',
    'toy': 'Toy', 'figurine': 'Figurine (Simpler)', 'plastic_ball': 'Plastic Ball', 'cardstock': 'Cardstock', 'candle': 'Candle', 'edible_flowers': 'Edible Flowers',
    'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish', 'icing_brush_stroke': 'Brush Stroke Finish',
    'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread', 'meringue_pop': 'Meringue Pop',
};
export const originalTypeLabelMap: Record<MainTopperType, string> = {
    'edible_3d_complex': '3D Complex', 'edible_3d_ordinary': '3D Ordinary', 'figurine': 'Figurine', 'toy': 'Toy', 'plastic_ball': 'Plastic Ball', 'cardstock': 'Cardstock',
    'edible_photo_top': 'Edible Photo', 'printout': 'Printout', 'candle': 'Candle', 'edible_flowers': 'Edible Flowers',
    'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish', 'icing_brush_stroke': 'Brush Stroke Finish',
    'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread', 'meringue_pop': 'Meringue Pop',
};
export const supportTypeDisplayMap: Record<SupportElementType, string> = {
    'edible_3d_support': 'Gumpaste (3D)', 'edible_2d_support': 'Gumpaste (2D)', 'chocolates': 'Chocolates',
    'sprinkles': 'Sprinkles', 'dragees': 'Dragees (Pearls)', 'support_printout': 'Printout', 'edible_photo_side': 'Printout (Edible)',
    'isomalt': 'Isomalt (Sugar Glass)', 'edible_flowers': 'Edible Flowers', 'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish',
    'icing_brush_stroke': 'Brush Stroke Finish', 'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread',
    'plastic_ball': 'Plastic Ball', 'plastic_ball_regular': 'Plastic Ball', 'plastic_ball_disco': 'Disco Ball',
    'macarons': 'Macarons', 'meringue': 'Meringue', 'gumpaste_bundle': 'Gumpaste Bundle', 'candy': 'Candy',
    'gumpaste_panel': 'Gumpaste Panel', 'icing_decorations': 'Icing Decorations', 'gumpaste_creations': 'Gumpaste Creations',
};
export const COLORABLE_ITEM_TYPES: Array<MainTopperType | SupportElementType> = [
    'edible_3d_complex', 'edible_3d_ordinary', 'edible_3d_support', 'edible_2d_support', 'edible_flowers', 'icing_doodle',
    'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop',
];

export const TopperCard: React.FC<{
    item: MainTopperUI | SupportElementUI;
    type: 'topper' | 'element';
    marker?: string;
    expanded: boolean;
    onToggle: () => void;
    updateItem: (updates: any) => void;
    onImageReplace: (file: File) => void;
    itemPrice?: number;
    isAdmin?: boolean;
}> = React.memo(({ item, type, marker, expanded, onToggle, updateItem, onImageReplace, itemPrice, isAdmin }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const isTopper = type === 'topper';
    const descriptionString = String(item.description || '');

    // Checks
    const isHumanFigure = descriptionString.toLowerCase().includes('person') ||
        descriptionString.toLowerCase().includes('character') ||
        descriptionString.toLowerCase().includes('human') ||
        descriptionString.toLowerCase().includes('figure') ||
        descriptionString.toLowerCase().includes('silhouette');

    const isNumberTopper = isTopper && descriptionString.toLowerCase().includes('number') && ['edible_3d_complex', 'edible_3d_ordinary', 'candle', 'printout'].includes(item.original_type);
    const is3DFlower = isTopper && ['edible_3d_complex', 'edible_3d_ordinary'].includes(item.original_type) && descriptionString.toLowerCase().includes('flower');
    const isOriginalPrintoutTopper = isTopper && item.original_type === 'printout' && !isNumberTopper;
    const canBeSwitchedToPrintoutTopper = isTopper && ['edible_3d_complex', 'edible_3d_ordinary', 'edible_photo_top'].includes(item.original_type) && !is3DFlower && !isNumberTopper;
    const isCardstock = isTopper && item.original_type === 'cardstock';
    const isToyOrFigurine = isTopper && ['toy', 'figurine', 'plastic_ball'].includes(item.original_type);
    const isWrapSwitchable = !isTopper && item.original_type === 'edible_photo_side';
    const isGumpasteSwitchable = !isTopper && ['edible_3d_support', 'edible_2d_support'].includes(item.original_type);
    const isOriginalPrintoutElement = !isTopper && item.original_type === 'support_printout';
    const hasMaterialOptions = isNumberTopper || isOriginalPrintoutTopper || canBeSwitchedToPrintoutTopper || isCardstock || isToyOrFigurine || isWrapSwitchable || isGumpasteSwitchable || isOriginalPrintoutElement;

    const isPrintoutOrPhoto = item.type === 'printout' || item.type === 'edible_photo_top' || item.type === 'support_printout' || item.type === 'edible_photo_side';
    const isDoodle = item.original_type === 'icing_doodle';
    const canChangeColor = isDoodle || (COLORABLE_ITEM_TYPES.includes(item.original_type) && 'original_color' in item && item.original_color);
    const isReplaceableIcingFigure = (item.type === 'icing_doodle' || item.type === 'icing_palette_knife') && isHumanFigure;
    const isReplaceableGumpasteFigure = (item.type === 'edible_3d_complex' || item.type === 'edible_3d_ordinary' || item.type === 'edible_3d_support') && isHumanFigure;
    const isPaletteKnife = item.type === 'icing_palette_knife';
    const canChangeMultipleColors = isPaletteKnife && 'colors' in item && item.colors && item.colors.length > 0;

    const materialLabel = isTopper ? topperTypeDisplayMap[item.type as MainTopperType] : supportTypeDisplayMap[item.type as SupportElementType];

    const handleImageReplace = async (file: File) => {
        setIsUploadingImage(true);
        try {
            await onImageReplace(file);
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleColorArrayChange = (colorIndex: number, newHex: string) => {
        if (item.colors) {
            const newColors = [...item.colors];
            newColors[colorIndex] = newHex;
            updateItem({ colors: newColors });
        }
    };

    return (
        <div className="w-full bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Header - Collapsible */}
            <div
                onClick={onToggle}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle();
                    }
                }}
            >
                {marker && (
                    <div className="shrink-0 w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-600 text-[10px] font-bold rounded-full">
                        {marker}
                    </div>
                )}
                <div className="grow">
                    <div className="text-xs font-medium text-slate-800">
                        {descriptionString}
                        {((item as MainTopperUI).quantity || 0) > 1 && ` × ${(item as MainTopperUI).quantity}`}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                        <span className="capitalize">{materialLabel || item.type.replace(/_/g, ' ')}</span> • {item.size}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && itemPrice !== undefined && itemPrice > 0 && (
                        <span className="text-[10px] font-semibold text-green-600">₱{itemPrice}</span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            updateItem({ isEnabled: !item.isEnabled });
                        }}
                        className={`relative inline-flex items-center h-5 w-9 transition-colors duration-200 ease-in-out rounded-full ${item.isEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}
                        aria-pressed={item.isEnabled}
                    >
                        <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${item.isEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                    <PencilIcon className="w-4 h-4 text-slate-400" />
                </div>
            </div>

            {/* Expanded Content - Customization Options */}
            {expanded && (
                <div className="px-2 pb-2 space-y-3 border-t border-slate-100">
                    {/* Material Type Options */}
                    {hasMaterialOptions && (
                        <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1.5">Material Type</label>
                            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-md">
                                {isNumberTopper && (
                                    <>
                                        <button onClick={() => updateItem({ type: (item as MainTopperUI).original_type })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${['edible_3d_complex', 'edible_3d_ordinary'].includes(item.type) ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible</button>
                                        <button onClick={() => updateItem({ type: 'candle' })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'candle' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Candle</button>
                                        <button onClick={() => updateItem({ type: 'printout' })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                    </>
                                )}
                                {isOriginalPrintoutTopper && (
                                    <>
                                        <button onClick={() => updateItem({ type: 'printout' })} className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Paper Printout</button>
                                        <button onClick={() => updateItem({ type: 'edible_photo_top', size: 'tiny' })} className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'edible_photo_top' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible Image</button>
                                    </>
                                )}
                                {canBeSwitchedToPrintoutTopper && (
                                    <>
                                        <button onClick={() => updateItem({ type: (item as MainTopperUI).original_type })} className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === (item as MainTopperUI).original_type ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>{originalTypeLabelMap[(item as MainTopperUI).original_type]}</button>
                                        <button onClick={() => updateItem({ type: 'printout' })} className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                    </>
                                )}
                                {isCardstock && (
                                    <>
                                        <button onClick={() => updateItem({ type: 'cardstock' })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'cardstock' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Cardstock</button>
                                        <button onClick={() => updateItem({ type: 'printout' })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                    </>
                                )}
                                {isToyOrFigurine && (
                                    <>
                                        <button onClick={() => updateItem({ type: (item as MainTopperUI).original_type })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === (item as MainTopperUI).original_type ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>{topperTypeDisplayMap[(item as MainTopperUI).original_type]}</button>
                                        <button onClick={() => updateItem({ type: 'printout' })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                    </>
                                )}
                                {isWrapSwitchable && (
                                    <>
                                        <button onClick={() => updateItem({ type: 'edible_photo_side' })} className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'edible_photo_side' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible Photo Wrap</button>
                                        <button onClick={() => updateItem({ type: 'support_printout' })} className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout Wrap</button>
                                    </>
                                )}
                                {(isGumpasteSwitchable || isOriginalPrintoutElement) && !isWrapSwitchable && (
                                    <>
                                        <button onClick={() => { const newType = isOriginalPrintoutElement ? 'edible_2d_support' : (item as SupportElementUI).original_type; updateItem({ type: newType }); }} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type !== 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Gumpaste</button>
                                        <button onClick={() => updateItem({ type: 'support_printout' })} className={`flex-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.type === 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Image Replacement */}
                    {(isPrintoutOrPhoto || isReplaceableIcingFigure || isReplaceableGumpasteFigure) && (
                        <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1.5">
                                {isReplaceableIcingFigure ? 'Replace Icing Figure' : isReplaceableGumpasteFigure ? 'Replace Gumpaste Figure' : 'Replacement Image'}
                            </label>
                            <div className="flex items-center">
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage} className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded-md hover:bg-slate-300 transition-colors flex items-center disabled:opacity-50 disabled:cursor-wait">
                                    {isUploadingImage ? (
                                        <>
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <PhotoIcon className="w-3 h-3 mr-1" />
                                            {item.replacementImage ? 'Change' : 'Upload'}
                                        </>
                                    )}
                                </button>
                                {item.replacementImage && !isUploadingImage && <span className="text-[10px] ml-2 text-green-600 font-medium">Image selected</span>}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                    if (e.target.files?.[0]) { handleImageReplace(e.target.files[0]); }
                                }} />
                            </div>
                            {isReplaceableIcingFigure && <p className="text-[10px] text-slate-500 mt-1">Upload a photo to convert into an icing-style portrait.</p>}
                            {isReplaceableGumpasteFigure && <p className="text-[10px] text-slate-500 mt-1">Upload a photo to convert into a gumpaste-style figure.</p>}
                        </div>
                    )}

                    {/* Color Picker */}
                    {canChangeColor && (() => {
                        const currentColor = item.color;
                        const originalColor = item.original_color;
                        const canRevert = originalColor && currentColor !== originalColor;

                        return (
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-[10px] font-medium text-slate-600">Color</label>
                                    {canRevert && (
                                        <button onClick={() => updateItem({ color: originalColor })} className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                            <ResetIcon className="w-3 h-3" />
                                            Revert
                                        </button>
                                    )}
                                </div>
                                <ColorPalette selectedColor={currentColor || ''} onColorChange={(newHex) => updateItem({ color: newHex })} />
                            </div>
                        );
                    })()}

                    {/* Multiple Colors */}
                    {canChangeMultipleColors && (
                        <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1.5">Colors</label>
                            <MultiColorEditor colors={(item as any).colors!} onColorChange={(index, newHex) => handleColorArrayChange(index, newHex)} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

TopperCard.displayName = 'TopperCard';
