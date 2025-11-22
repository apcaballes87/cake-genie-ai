
// components/FloatingResultPanel.tsx
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MainTopperUI, SupportElementUI, CakeMessageUI, MainTopperType, SupportElementType, IcingDesignUI, IcingColorDetails, CakeType, HybridAnalysisResult, AnalysisItem } from '../types';
import { Wand2 } from 'lucide-react';
import { PencilIcon, PhotoIcon, TrashIcon, BackIcon, Loader2, ResetIcon } from './icons';
import { ColorPalette } from './ColorPalette';
import { MultiColorEditor } from './MultiColorEditor';

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
  selectedItem: AnalysisItem | AnalysisItem[] | null;
  onClose: () => void;
  mainToppers: MainTopperUI[];
  updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
  removeMainTopper: (id: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => Promise<void>;
  supportElements: SupportElementUI[];
  updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
  removeSupportElement: (id: string) => void;
  onSupportElementImageReplace: (elementId: string, file: File) => Promise<void>;
  cakeMessages: CakeMessageUI[];
  updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
  removeCakeMessage: (id: string) => void;
  onCakeMessageChange: (messages: CakeMessageUI[]) => void;
  icingDesign: IcingDesignUI | null;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  analysisResult: HybridAnalysisResult | null;
  itemPrices: Map<string, number>;
  onUpdateDesign: () => void;
  isUpdatingDesign: boolean;
  isAdmin?: boolean;
  onChangesApplied?: () => void;
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
    itemPrices,
    onUpdateDesign,
    isUpdatingDesign,
    isAdmin,
    onChangesApplied
}) => {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = dragStartX !== null;
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isUploadingImageFor, setIsUploadingImageFor] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<CakeMessageUI | null>(null);

  const upToDateItems = useMemo(() => {
    if (!selectedItem) return null;

    const items = Array.isArray(selectedItem) ? selectedItem : [selectedItem];

    const updatedItems = items.map(item => {
        if (!item) return null;
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
                return item; // Icing items don't have separate state from the main hook
        }
        // If the item was removed from the main state, it will be null here.
        // For new messages, the item won't be in the main state yet, so return the original item.
        if (item.itemCategory === 'message' && !foundItem) {
          return item;
        }
        return foundItem ? { ...item, ...foundItem } : null;
    }).filter((item): item is AnalysisItem => item !== null); // Filter out nulls and type guard

    if (updatedItems.length === 0) return null;

    // Return a single item if that's what was passed in, otherwise return the array
    return Array.isArray(selectedItem) ? updatedItems : updatedItems[0];
  }, [selectedItem, mainToppers, supportElements, cakeMessages]);

  useEffect(() => {
    if (upToDateItems && 'itemCategory' in upToDateItems && upToDateItems.itemCategory === 'message') {
        setLocalMessage(upToDateItems as CakeMessageUI);
    } else {
        setLocalMessage(null);
    }
  }, [upToDateItems]);

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
      if (selectedItem && !upToDateItems) {
          onClose();
      }
  }, [selectedItem, upToDateItems, onClose]);

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

    const handleApplyMessageChanges = () => {
        if (!localMessage || !localMessage.text.trim()) {
            onClose(); // Just close if there's no text.
            return;
        }
    
        const isNew = !cakeMessages.some(m => m.id === localMessage.id);
    
        if (isNew) {
            const finalNewMessage: CakeMessageUI = {
                ...localMessage,
                id: uuidv4(), // Generate a real ID
            };
            onCakeMessageChange([...cakeMessages, finalNewMessage]);
        } else {
            updateCakeMessage(localMessage.id, {
                text: localMessage.text,
                color: localMessage.color
            });
        }
        
        if (onChangesApplied) {
            onChangesApplied();
        } else {
            onUpdateDesign();
        }
        onClose();
    };
    
    const handleRemoveMessage = () => {
        if (!localMessage) return;
    
        const isExisting = cakeMessages.some(m => m.id === localMessage.id);
        if (isExisting) {
            removeCakeMessage(localMessage.id);
            if (onChangesApplied) {
                onChangesApplied();
            } else {
                onUpdateDesign();
            }
        }
        
        onClose();
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
                     <div className="space-y-3">
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
                                    <ColorPalette 
                                        selectedColor={currentColor || ''} 
                                        onColorChange={(newHex) => (isTopper ? updateMainTopper : updateSupportElement)(item.id, { color: newHex })} 
                                    />
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
                {isTopper && (item as MainTopperUI).type === 'edible_photo' && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                        <button
                            onClick={() => {
                                if (onChangesApplied) {
                                    onChangesApplied();
                                } else {
                                    onUpdateDesign();
                                }
                                onClose();
                            }}
                            disabled={isUpdatingDesign}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {isUpdatingDesign ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                            {isUpdatingDesign ? 'Applying...' : 'Apply Changes'}
                        </button>
                    </div>
                )}
            </PanelToggle>
        );
    }
    if (itemToRender.itemCategory === 'message' && localMessage) {
        return (
             <div className="p-2 rounded-md">
                <div className="flex justify-between items-center">
                    <div className="text-xs font-medium text-slate-800">
                        Edit Message
                    </div>
                    <button 
                        type="button" 
                        onClick={handleRemoveMessage} 
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors" 
                        aria-label="Remove message"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 space-y-3">
                    <div>
                        <label htmlFor={`message-text-${localMessage.id}`} className="block text-xs font-medium text-slate-600 mb-1">Text</label>
                        <input
                            id={`message-text-${localMessage.id}`}
                            type="text"
                            value={localMessage.text}
                            onChange={(e) => setLocalMessage(prev => prev ? { ...prev, text: e.target.value } : null)}
                            className="w-full px-3 py-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Your Text Here"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
                        <ColorPalette 
                            selectedColor={localMessage.color} 
                            onColorChange={(hex) => setLocalMessage(prev => prev ? { ...prev, color: hex } : null)} 
                        />
                    </div>
                     <button
                        onClick={handleApplyMessageChanges}
                        disabled={isUpdatingDesign}
                        className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    >
                        {isUpdatingDesign ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                        {isUpdatingDesign ? 'Applying...' : 'Apply Changes'}
                    </button>
                </div>
            </div>
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
            {upToDateItems && (
                Array.isArray(upToDateItems) ? (
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-800 px-2">{upToDateItems.length} Clustered Items</h3>
                        {upToDateItems.map(item => (
                            <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg">
                                {renderSingleItemEditor(item as AnalysisItem)}
                            </div>
                        ))}
                    </div>
                ) : (
                    renderSingleItemEditor(upToDateItems as AnalysisItem)
                )
            )}
        </div>
    </div>
  );
};
