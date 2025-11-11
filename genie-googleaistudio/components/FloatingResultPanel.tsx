// components/FloatingResultPanel.tsx
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MainTopperUI, SupportElementUI, CakeMessageUI, MainTopperType, SupportElementType, IcingDesignUI, IcingColorDetails, CakeType, HybridAnalysisResult } from '../types';
// FIX: Changed import from non-existent ArrowLeft to BackIcon.
import { PencilIcon, PhotoIcon, TrashIcon, BackIcon, Loader2, ResetIcon } from './icons';
import { ColorPalette } from './ColorPalette';
import { MultiColorEditor } from './MultiColorEditor';
import { ClusteredMarker, AnalysisItem } from '../app/customizing/page';

// --- Constants copied from FeatureList.tsx for self-containment ---
const topperTypeDisplayMap: Record<MainTopperType, string> = {
  'edible_3d_complex': 'Gumpaste (Complex)', 'edible_3d_ordinary': 'Gumpaste (Ordinary)', 'printout': 'Printout', 'edible_photo': 'Printout (Edible)',
  'toy': 'Toy', 'figurine': 'Figurine (Simpler)', 'plastic_ball': 'Plastic Ball', 'cardstock': 'Cardstock', 'candle': 'Candle',
  'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish', 'icing_brush_stroke': 'Brush Stroke Finish',
  'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread', 'meringue_pop': 'Meringue Pop',
};
const originalTypeLabelMap: Record<MainTopperType, string> = {
    'edible_3d_complex': '3D Complex', 'edible_3d_ordinary': '3D Ordinary', 'figurine': 'Figurine', 'toy': 'Toy', 'plastic_ball': 'Plastic Ball', 'cardstock': 'Cardstock',
    'edible_photo': 'Edible Photo', 'printout': 'Printout', 'candle': 'Candle',
    'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish', 'icing_brush_stroke': 'Brush Stroke Finish',
    'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread', 'meringue_pop': 'Meringue Pop',
};
const supportTypeDisplayMap: Record<SupportElementType, string> = {
    'edible_3d_support': 'Gumpaste (3D)', 'edible_2d_support': 'Gumpaste (2D)', 'chocolates': 'Chocolates',
    'sprinkles': 'Sprinkles', 'dragees': 'Dragees (Pearls)', 'support_printout': 'Printout', 'edible_photo_side': 'Printout (Edible)',
    'isomalt': 'Isomalt (Sugar Glass)', 'edible_flowers': 'Edible Flowers', 'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish',
    'icing_brush_stroke': 'Brush Stroke Finish', 'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread',
};
const COLORABLE_ITEM_TYPES: Array<MainTopperType | SupportElementType> = [
    'edible_3d_complex', 'edible_3d_ordinary', 'edible_3d_support', 'edible_2d_support', 'edible_flowers', 'icing_doodle',
    'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop',
];
// --- End of copied constants ---

interface FloatingResultPanelProps {
  selectedItem: ClusteredMarker | null;
  onClose: () => void;
  mainToppers: MainTopperUI[];
  updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
  removeMainTopper: (id: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => void;
  supportElements: SupportElementUI[];
  updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
  removeSupportElement: (id: string) => void;
  onSupportElementImageReplace: (elementId: string, file: File) => void;
  cakeMessages: CakeMessageUI[];
  updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
  removeCakeMessage: (id: string) => void;
  onCakeMessageChange: (messages: CakeMessageUI[]) => void;
  icingDesign: IcingDesignUI | null;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  analysisResult: HybridAnalysisResult | null;
  itemPrices: Map<string, number>;
  isAdmin?: boolean;
}

const SimpleToggle: React.FC<{ label: string; isEnabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean; }> = ({ label, isEnabled, onChange, disabled=false }) => (
    <div className={`flex justify-between items-center p-1 ${disabled ? 'opacity-50' : ''}`}>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <button
            type="button"
            onClick={() => !disabled && onChange(!isEnabled)}
            disabled={disabled}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}
            aria-pressed={isEnabled}
        >
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const PanelToggle: React.FC<{ label: React.ReactNode; isEnabled: boolean; onChange: (enabled: boolean) => void; price?: number; children?: React.ReactNode; onDelete?: () => void; disabled?: boolean; }> = ({ label, isEnabled, onChange, price, children, onDelete, disabled = false }) => (
    <div className={`p-2 rounded-md transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-60'} ${disabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : ''}`}>
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className={`text-xs font-medium ${isEnabled ? 'text-slate-800' : 'text-slate-500 line-through'} ${disabled ? 'text-slate-400' : ''}`}>{label}</div>
            </div>
            <div className="flex items-center space-x-2">
                {price !== undefined && price > 0 && <span className={`text-xs font-semibold ${isEnabled ? 'text-green-600' : 'text-slate-400 line-through'}`}>₱{price}</span>}
                {onDelete && (
                    <button type="button" onClick={!disabled ? onDelete : undefined} disabled={disabled} className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50" aria-label="Remove item">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
                <button type="button" onClick={() => !disabled && onChange(!isEnabled)} disabled={disabled} className={`relative inline-flex items-center h-5 w-9 transition-colors rounded-full ${isEnabled ? 'bg-purple-600' : 'bg-slate-300'} ${disabled ? 'cursor-not-allowed' : ''}`} aria-pressed={isEnabled}>
                    <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
        {isEnabled && !disabled && children && <div className="mt-2 pt-2 border-t border-slate-100">{children}</div>}
    </div>
);


export const FloatingResultPanel: React.FC<FloatingResultPanelProps> = ({ 
    selectedItem, 
    onClose,
    mainToppers, updateMainTopper, removeMainTopper, onTopperImageReplace,
    supportElements, updateSupportElement, removeSupportElement, onSupportElementImageReplace,
    cakeMessages, updateCakeMessage, removeCakeMessage, onCakeMessageChange,
    icingDesign, onIcingDesignChange,
    analysisResult,
    itemPrices, isAdmin 
}) => {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = dragStartX !== null;
  const [editingColorForItemId, setEditingColorForItemId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isUploadingImageFor, setIsUploadingImageFor] = useState<string | null>(null);


  const upToDateItem = useMemo(() => {
    if (!selectedItem) return null;
    
    if ('isCluster' in selectedItem && selectedItem.isCluster) {
        const updatedItems = selectedItem.items.map(item => {
            let foundItem;
            switch (item.itemCategory) {
                case 'topper':
                    foundItem = mainToppers.find(t => t.id === item.id);
                    break;
                case 'element':
                    foundItem = supportElements.find(e => e.id === item.id);
                    break;
                case 'message':
                    foundItem = cakeMessages.find(m => m.id === item.id);
                    break;
                default:
                    return item; // For 'icing'
            }
            // Return null if item was deleted, so it can be filtered out
            return foundItem ? { ...item, ...foundItem } : null; 
        }).filter((item): item is AnalysisItem => item !== null);

        // If all items in cluster were deleted, the whole cluster is gone
        if (updatedItems.length === 0) return null;

        return { ...selectedItem, items: updatedItems };
    }

    // Handle single items
    const item = selectedItem as AnalysisItem;
    let foundItem;
    switch (item.itemCategory) {
        case 'topper':
            foundItem = mainToppers.find(t => t.id === item.id);
            break;
        case 'element':
            foundItem = supportElements.find(e => e.id === item.id);
            break;
        case 'message':
            foundItem = cakeMessages.find(m => m.id === item.id);
            break;
        default:
            return item;
    }
    return foundItem ? { ...item, ...foundItem } : null;
  }, [selectedItem, mainToppers, supportElements, cakeMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (selectedItem) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [selectedItem, onClose]);

  useEffect(() => {
      if (selectedItem && !upToDateItem) {
          onClose();
      }
  }, [selectedItem, upToDateItem, onClose]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setDragStartX('touches' in e ? e.touches[0].clientX : e.clientX);
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (dragStartX === null) return;
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = currentX - dragStartX;
    if (delta > 0) {
      setDragDeltaX(delta);
    }
  }, [dragStartX]);

  const handleDragEnd = useCallback(() => {
    if (panelRef.current) panelRef.current.style.transition = 'transform 0.3s ease-out';
    if (dragDeltaX > 100) {
      onClose();
    }
    setDragStartX(null);
    setDragDeltaX(0);
  }, [dragDeltaX, onClose]);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    setEditingColorForItemId(null);
  }, [selectedItem]);

    const handleImageReplace = async (itemCategory: 'topper' | 'element', itemId: string, file: File) => {
        setIsUploadingImageFor(itemId);
        try {
            if (itemCategory === 'topper') {
                await onTopperImageReplace(itemId, file);
            } else {
                await onSupportElementImageReplace(itemId, file);
            }
        } catch (error) {
            console.error("Image replacement failed in panel:", error);
        } finally {
            setIsUploadingImageFor(null);
        }
    };

    const handleTopperColorArrayChange = (topperId: string, colorIndex: number, newHex: string) => {
        const topper = mainToppers.find(t => t.id === topperId);
        if (topper && topper.colors) {
            const newColors = [...topper.colors];
            newColors[colorIndex] = newHex;
            updateMainTopper(topperId, { colors: newColors });
        }
    };

    const handleSupportColorArrayChange = (elementId: string, colorIndex: number, newHex: string) => {
        const element = supportElements.find(e => e.id === elementId);
        if (element && element.colors) {
            const newColors = [...element.colors];
            newColors[colorIndex] = newHex;
            updateSupportElement(elementId, { colors: newColors });
        }
    };

  const inViewClass = 'translate-x-0';
  const outOfViewClass = 'translate-x-[calc(100%+2rem)]';
  
  const renderSingleItemEditor = (itemToRender: AnalysisItem) => {
    if (itemToRender.itemCategory === 'topper' || itemToRender.itemCategory === 'element') {
        const item = itemToRender as MainTopperUI | SupportElementUI;
        const isTopper = itemToRender.itemCategory === 'topper';
        
        const descriptionString = String(item.description || '');

        // Centralized human figure check
        const isHumanFigure = descriptionString.toLowerCase().includes('person') || 
                              descriptionString.toLowerCase().includes('character') || 
                              descriptionString.toLowerCase().includes('human') || 
                              descriptionString.toLowerCase().includes('figure') || 
                              descriptionString.toLowerCase().includes('silhouette');

        // Material Options Flags
        const isNumberTopper = isTopper && descriptionString.toLowerCase().includes('number') && ['edible_3d_complex', 'edible_3d_ordinary', 'candle', 'printout'].includes(item.original_type);
        const is3DFlower = isTopper && ['edible_3d_complex', 'edible_3d_ordinary'].includes(item.original_type) && descriptionString.toLowerCase().includes('flower');
        const isOriginalPrintoutTopper = isTopper && item.original_type === 'printout';
        const canBeSwitchedToPrintoutTopper = isTopper && ['edible_3d_complex', 'edible_3d_ordinary', 'edible_photo'].includes(item.original_type) && !is3DFlower;
        const isCardstock = isTopper && item.original_type === 'cardstock';
        const isToyOrFigurine = isTopper && ['toy', 'figurine', 'plastic_ball'].includes(item.original_type);
        const isWrapSwitchable = !isTopper && item.original_type === 'edible_photo_side';
        const isGumpasteSwitchable = !isTopper && ['edible_3d_support', 'edible_2d_support'].includes(item.original_type);
        const isOriginalPrintoutElement = !isTopper && item.original_type === 'support_printout';
        const hasMaterialOptions = isNumberTopper || isOriginalPrintoutTopper || canBeSwitchedToPrintoutTopper || isCardstock || isToyOrFigurine || isWrapSwitchable || isGumpasteSwitchable || isOriginalPrintoutElement;

        // Other Options Flags
        const isPrintoutOrPhoto = item.type === 'printout' || item.type === 'edible_photo' || item.type === 'support_printout' || item.type === 'edible_photo_side';
        const isDoodle = item.original_type === 'icing_doodle';
        const canChangeColor = isDoodle || (COLORABLE_ITEM_TYPES.includes(item.original_type) && 'original_color' in item && item.original_color);
        const isReplaceableIcingFigure = (item.type === 'icing_doodle' || item.type === 'icing_palette_knife') && isHumanFigure;
        const isReplaceableGumpasteFigure = (item.type === 'edible_3d_complex' || item.type === 'edible_3d_ordinary' || item.type === 'edible_3d_support') && isHumanFigure;
        const isPaletteKnife = item.type === 'icing_palette_knife';
        const canChangeMultipleColors = isPaletteKnife && 'colors' in item && item.colors && item.colors.length > 0;
        
        const hasOptions = hasMaterialOptions || isPrintoutOrPhoto || canChangeColor || isReplaceableIcingFigure || isReplaceableGumpasteFigure || canChangeMultipleColors;
        
        const materialLabel = isTopper ? topperTypeDisplayMap[item.type as MainTopperType] : supportTypeDisplayMap[item.type as SupportElementType];
        const itemLabel = (
            <div className="flex flex-col items-start">
                <span className="leading-tight text-xs">{`${descriptionString} (${'size' in item ? item.size : 'coverage' in item ? item.coverage : ''})`}</span>
                <span className="text-[10px] text-purple-600 font-semibold bg-purple-100 px-1.5 py-0.5 rounded-md mt-1">{materialLabel}</span>
            </div>
        );

        return (
            <PanelToggle
                label={itemLabel}
                isEnabled={item.isEnabled}
                price={isAdmin ? itemPrices.get(item.id) : undefined}
                onChange={(isEnabled) => (isTopper ? updateMainTopper : updateSupportElement)(item.id, { isEnabled })}
            >
                {hasOptions && (
                     <div className="mt-2 pt-2 border-t border-slate-100 space-y-3">
                        {hasMaterialOptions && (
                            <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">Material Type</label>
                                <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-md">
                                    {isNumberTopper && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: (item as MainTopperUI).original_type })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${['edible_3d_complex', 'edible_3d_ordinary'].includes(item.type) ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'candle' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'candle' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Candle</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isOriginalPrintoutTopper && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Paper Printout</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'edible_photo' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'edible_photo' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible Image</button>
                                        </>
                                    )}
                                    {canBeSwitchedToPrintoutTopper && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: (item as MainTopperUI).original_type })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === (item as MainTopperUI).original_type ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>{originalTypeLabelMap[(item as MainTopperUI).original_type]}</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isCardstock && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'cardstock' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'cardstock' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Cardstock</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isToyOrFigurine && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: (item as MainTopperUI).original_type })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === (item as MainTopperUI).original_type ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>{topperTypeDisplayMap[(item as MainTopperUI).original_type]}</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isWrapSwitchable && (
                                        <>
                                            <button onClick={() => updateSupportElement(item.id, { type: 'edible_photo_side' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'edible_photo_side' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible Photo Wrap</button>
                                            <button onClick={() => updateSupportElement(item.id, { type: 'support_printout' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout Wrap</button>
                                        </>
                                    )}
                                    {(isGumpasteSwitchable || isOriginalPrintoutElement) && !isWrapSwitchable && (
                                        <>
                                            <button onClick={() => { const newType = isOriginalPrintoutElement ? 'edible_2d_support' : (item as SupportElementUI).original_type; updateSupportElement(item.id, { type: newType }); }} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type !== 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Gumpaste</button>
                                            <button onClick={() => updateSupportElement(item.id, { type: 'support_printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        {(isPrintoutOrPhoto || isReplaceableIcingFigure || isReplaceableGumpasteFigure) && (
                            <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">
                                    {isReplaceableIcingFigure ? 'Replace Icing Figure' : isReplaceableGumpasteFigure ? 'Replace Gumpaste Figure' : 'Replacement Image'}
                                </label>
                                <div className="flex items-center">
                                    <button type="button" onClick={() => fileInputRefs.current[item.id]?.click()} disabled={isUploadingImageFor === item.id} className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded-md hover:bg-slate-300 transition-colors flex items-center disabled:opacity-50 disabled:cursor-wait">
                                        {isUploadingImageFor === item.id ? (
                                            <>
                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <PhotoIcon className="w-3 h-3 mr-1"/>
                                                {item.replacementImage ? 'Change' : 'Upload'}
                                            </>
                                        )}
                                    </button>
                                    {item.replacementImage && isUploadingImageFor !== item.id && <span className="text-[10px] ml-2 text-green-600 font-medium">Image selected</span>}
                                    <input type="file" ref={el => { fileInputRefs.current[item.id] = el; }} className="hidden" accept="image/*" onChange={(e) => {
                                        if (e.target.files?.[0]) { handleImageReplace(isTopper ? 'topper' : 'element', item.id, e.target.files[0]); }
                                    }}/>
                                </div>
                                {isReplaceableIcingFigure && <p className="text-[10px] text-slate-500 mt-1">Upload a photo to convert into an icing-style portrait.</p>}
                                {isReplaceableGumpasteFigure && <p className="text-[10px] text-slate-500 mt-1">Upload a photo to convert into a gumpaste-style figure.</p>}
                                {isTopper && item.type === 'edible_photo' && item.replacementImage && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newMessage: CakeMessageUI = {
                                                id: uuidv4(),
                                                type: 'icing_script',
                                                text: 'Your Text Here',
                                                position: 'top',
                                                color: '#000000',
                                                isEnabled: true,
                                                price: 0,
                                            };
                                            onCakeMessageChange([...cakeMessages, newMessage]);
                                        }}
                                        className="mt-2 w-full text-center text-xs font-semibold text-purple-600 hover:text-purple-800 py-1.5 rounded-lg hover:bg-purple-50 transition-colors border border-dashed border-purple-300"
                                    >
                                        + Add Message On Photo
                                    </button>
                                )}
                            </div>
                        )}
                        {canChangeColor && (() => {
                            const currentColor = item.color;
                            const originalColor = item.original_color;
                            const canRevert = originalColor && currentColor !== originalColor;

                            const handleRevert = () => {
                                if (canRevert) {
                                    (isTopper ? updateMainTopper : updateSupportElement)(item.id, { color: originalColor });
                                }
                            };

                            return (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[10px] font-medium text-slate-600">Color</label>
                                        {canRevert && (
                                            <button onClick={handleRevert} className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                                <ResetIcon className="w-3 h-3" />
                                                Revert
                                            </button>
                                        )}
                                    </div>
                                    {editingColorForItemId === item.id ? (
                                        <div className="animate-fade-in-fast">
                                            <ColorPalette selectedColor={currentColor || ''} onColorChange={(newHex) => { (isTopper ? updateMainTopper : updateSupportElement)(item.id, { color: newHex }); setEditingColorForItemId(null); }} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full border border-slate-300" style={{ backgroundColor: currentColor || '#FFFFFF' }}></div>
                                            <button type="button" onClick={() => setEditingColorForItemId(item.id)} className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                                <PencilIcon className="w-3 h-3" /> Change
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        {canChangeMultipleColors && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                                <MultiColorEditor colors={(item as any).colors!} onColorChange={(index, newHex) => {
                                    isTopper ? handleTopperColorArrayChange(item.id, index, newHex) : handleSupportColorArrayChange(item.id, index, newHex);
                                }} />
                            </div>
                        )}
                    </div>
                )}
            </PanelToggle>
        );
    }
    if (itemToRender.itemCategory === 'message') {
        const message = itemToRender as CakeMessageUI;
        return (
             <PanelToggle
                label={`Message: "${message.text}"`}
                isEnabled={message.isEnabled}
                price={isAdmin ? itemPrices.get(message.id) : undefined}
                onChange={(isEnabled) => updateCakeMessage(message.id, { isEnabled })}
            >
                <div className="space-y-3">
                    <div>
                        <label htmlFor={`msg-text-${message.id}`} className="block text-[10px] font-medium text-slate-600 mb-1">Text</label>
                        <input id={`msg-text-${message.id}`} type="text" value={message.text} onChange={(e) => updateCakeMessage(message.id, { text: e.target.value })} className="w-full px-2 py-1 text-xs border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-600 mb-1">Color</label>
                        {editingColorForItemId === message.id ? (
                            <div className="animate-fade-in-fast">
                                <ColorPalette selectedColor={message.color} onColorChange={(hex) => { updateCakeMessage(message.id, { color: hex }); setEditingColorForItemId(null); }} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full border border-slate-300" style={{ backgroundColor: message.color || '#FFFFFF' }}></div>
                                <button type="button" onClick={() => setEditingColorForItemId(message.id)} className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                    <PencilIcon className="w-3 h-3" /> Change
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </PanelToggle>
        );
    }
    
    if (itemToRender.itemCategory === 'icing') {
        if (!icingDesign || !itemToRender) return null;

        const description = itemToRender.description;
        const cakeType = (itemToRender as any).cakeType || '1 Tier'; // Default to avoid crash
        const isBento = cakeType === 'Bento';
        
        const renderToggleAndColor = (
            featureKey: 'drip' | 'border_top' | 'border_base' | 'gumpasteBaseBoard',
            colorKey: keyof IcingColorDetails,
            label: string
        ) => {
            const originalColor = analysisResult?.icing_design.colors[colorKey];
            const currentColor = icingDesign.colors[colorKey];
            const canRevert = originalColor && currentColor !== originalColor;

            const handleRevert = () => {
                if (canRevert) {
                    onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: originalColor } });
                }
            };
            
            return (
                <>
                    <SimpleToggle
                        label={label}
                        isEnabled={icingDesign[featureKey]}
                        disabled={ (featureKey === 'border_base' || featureKey === 'gumpasteBaseBoard') && isBento}
                        onChange={(isEnabled) => {
                            const newIcingDesign = { ...icingDesign, [featureKey]: isEnabled };
                            if (isEnabled && !newIcingDesign.colors[colorKey]) {
                                newIcingDesign.colors = { ...newIcingDesign.colors, [colorKey]: '#FFFFFF' };
                            }
                            onIcingDesignChange(newIcingDesign);
                        }}
                    />
                    {icingDesign[featureKey] && (
                        <div className="mt-2 pt-2 border-t border-slate-100 pl-1">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-slate-600">Color</label>
                                {canRevert && (
                                    <button onClick={handleRevert} className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                        <ResetIcon className="w-3 h-3" />
                                        Revert to Original
                                    </button>
                                )}
                            </div>
                            <ColorPalette selectedColor={icingDesign.colors[colorKey] || ''} onColorChange={(newHex) => {
                                onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: newHex } });
                            }} />
                        </div>
                    )}
                </>
            );
        };

        const renderColorOnly = (colorKey: keyof IcingColorDetails, label: string) => {
            const originalColor = analysisResult?.icing_design.colors[colorKey];
            const currentColor = icingDesign.colors[colorKey];
            const canRevert = originalColor && currentColor !== originalColor;
            
            const handleRevert = () => {
                if (canRevert) {
                    onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: originalColor } });
                }
            };

            return (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-slate-800">{label}</label>
                         {canRevert && (
                            <button onClick={handleRevert} className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                <ResetIcon className="w-3 h-3" />
                                Revert to Original
                            </button>
                        )}
                    </div>
                    <ColorPalette selectedColor={icingDesign.colors[colorKey] || ''} onColorChange={(newHex) => {
                        onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: newHex } });
                    }} />
                </div>
            );
        };

        switch (description) {
            case 'Drip Effect':
                return renderToggleAndColor('drip', 'drip', 'Enable Drip Effect');
            case 'Top Border':
                return renderToggleAndColor('border_top', 'borderTop', 'Enable Top Border');
            case 'Base Border':
                return renderToggleAndColor('border_base', 'borderBase', 'Enable Base Border');
            case 'Gumpaste Covered Board':
                return renderToggleAndColor('gumpasteBaseBoard', 'gumpasteBaseBoardColor', 'Enable Covered Board');
            case 'Side Icing Color':
                return renderColorOnly('side', 'Side Icing Color');
            case 'Top Icing Color':
                return renderColorOnly('top', 'Top Icing Color');
            default:
                return <p className="p-2 text-xs text-slate-500">Select an icing feature to edit.</p>;
        }
    }
    
    return <p className="p-2 text-xs text-slate-500">No editable properties for this item.</p>;
  }


  return (
    <div
      ref={panelRef}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      className={`fixed bottom-28 right-4 w-80 max-w-[90vw] bg-white/90 backdrop-blur-lg shadow-2xl border border-slate-200 z-50 flex flex-col transform rounded-xl ${selectedItem && !isDragging ? 'transition-transform duration-300 ease-out' : ''} ${selectedItem ? inViewClass : outOfViewClass}`}
      style={isDragging ? { transform: `translateX(${dragDeltaX}px)` } : {}}
    >
        <div className="p-3 flex-grow overflow-y-auto space-y-3">
            {(() => {
                if (!upToDateItem) return null;

                if ('isCluster' in upToDateItem && upToDateItem.isCluster) {
                    return (
                        <div>
                            <h3 className="text-xs font-semibold text-slate-500 mb-2">{upToDateItem.items.length} Items Found Here</h3>
                            <div className="space-y-2">
                                {upToDateItem.items.map(item => (
                                    <div key={item.id} className="border border-slate-200 rounded-lg bg-white">
                                        {renderSingleItemEditor(item)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }
                
                // It's a single item
                return renderSingleItemEditor(upToDateItem as AnalysisItem);
            })()}
        </div>
    </div>
  );
};