import React, { useState, useRef, useEffect } from 'react';
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, MainTopperType, CakeInfoUI, CakeType, CakeThickness, CakeFlavor, BasePriceInfo, SupportElementType } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { ChevronDownIcon, PhotoIcon, SideIcingGuideIcon, TopIcingGuideIcon, TopBorderGuideIcon, BaseBorderGuideIcon, PencilIcon, BaseBoardGuideIcon, TrashIcon } from './icons';
import { ColorPalette } from './ColorPalette';
import { CAKE_TYPES, THICKNESS_OPTIONS_MAP, ANALYSIS_PHRASES, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, FLAVOR_OPTIONS, FLAVOR_THUMBNAILS, TIER_THUMBNAILS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { ToggleSkeleton, CakeBaseSkeleton } from './LoadingSkeletons';

const DRIP_THUMBNAIL_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/dripeffect.webp';

interface FeatureListProps {
  analysisError: string | null;
  analysisId: string | null;
  cakeInfo: CakeInfoUI | null;
  basePriceOptions: BasePriceInfo[] | null;
  mainToppers: MainTopperUI[];
  supportElements: SupportElementUI[];
  cakeMessages: CakeMessageUI[];
  icingDesign: IcingDesignUI | null;
  additionalInstructions: string;
  onCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
  onMainTopperChange: (toppers: MainTopperUI[]) => void;
  onSupportElementChange: (elements: SupportElementUI[]) => void;
  onCakeMessageChange: (message: CakeMessageUI[]) => void;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  onAdditionalInstructionsChange: (instructions: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => void;
  onSupportElementImageReplace: (elementId: string, file: File) => void;
  isAnalyzing: boolean;
  // --- New props for Shopify flow ---
  hideBaseOptions?: boolean;
  hideSupportElements?: boolean;
  onAddPrintoutTopper?: () => void;
  onSetPrimaryMessage?: (update: { text?: string, color?: string, useDefaultColor?: boolean }) => void;
  primaryMessage?: CakeMessageUI;
  onSetBaseBoardMessage?: (update: { text?: string, color?: string, useDefaultColor?: boolean }) => void;
  baseBoardMessage?: CakeMessageUI;
  defaultOpenInstructions?: boolean;
  shopifyFixedSize?: string;
  shopifyBasePrice?: number;
}

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)',
    '2 Tier': '2 Tier (Soft icing)',
    '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant',
    '2 Tier Fondant': '2 Tier Fondant',
    '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square',
    'Rectangle': 'Rectangle',
    'Bento': 'Bento',
};

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number; analysisText?: string }> = ({ title, children, defaultOpen = true, count, analysisText }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    useEffect(() => {
        setIsOpen(defaultOpen);
    }, [defaultOpen]);

    return (
        <div className="bg-slate-50 rounded-lg border border-slate-200">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-700">{title}</h3>
                    {analysisText && <span className="text-xs text-slate-500 animate-pulse">{analysisText}</span>}
                    {count !== undefined && count > 0 && (
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
                    )}
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="p-4 pt-0 space-y-3">{children}</div>}
        </div>
    );
};

const Toggle: React.FC<{ label: string; isEnabled: boolean; onChange: (enabled: boolean) => void; price?: number; children?: React.ReactNode; icon?: React.ReactNode; onDelete?: () => void; disabled?: boolean; showPrice?: boolean; }> = ({ label, isEnabled, onChange, price, children, icon, onDelete, disabled = false, showPrice = true }) => (
    <div className={`bg-white p-3 rounded-md border border-slate-200 transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-60'} ${disabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : ''}`}>
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
                {icon}
                <span className={`text-sm font-medium ${isEnabled ? 'text-slate-800' : 'text-slate-500 line-through'} ${disabled ? 'text-slate-400' : ''}`}>{label}</span>
            </div>
            <div className="flex items-center space-x-2">
                {price !== undefined && showPrice && <span className={`font-semibold ${isEnabled ? 'text-green-600' : 'text-slate-400 line-through'}`}>₱{price}</span>}
                {onDelete && (
                    <button
                        type="button"
                        onClick={!disabled ? onDelete : undefined}
                        disabled={disabled}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
                        aria-label="Remove item"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => !disabled && onChange(!isEnabled)}
                    disabled={disabled}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-slate-300'} ${disabled ? 'cursor-not-allowed' : ''}`}
                    aria-pressed={isEnabled}
                >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
        {isEnabled && !disabled && children && <div className="mt-3">{children}</div>}
    </div>
);

const GroupedItems: React.FC<{
    items: (MainTopperUI | SupportElementUI)[];
    renderItem: (item: any) => React.ReactNode;
}> = ({ items, renderItem }) => {
    const groups = items.reduce((acc, item) => {
        (acc[item.group_id] = acc[item.group_id] || []).push(item);
        return acc;
    }, {} as Record<string, (MainTopperUI | SupportElementUI)[]>);

    return (
        <>
            {Object.values(groups).map((group, index) => {
                if (!Array.isArray(group) || group.length === 0) {
                    return null;
                }

                if (group.length > 1) {
                    const first = group[0];
                    return (
                        <div key={index} className="bg-white p-3 rounded-md border border-slate-200">
                             <p className="text-sm font-medium text-slate-800">Set of {group.length} {first.description}</p>
                             <div className="pl-4 mt-2 space-y-2">
                                {group.map(item => renderItem(item))}
                             </div>
                        </div>
                    );
                }
                return renderItem(group[0]);
            })}
        </>
    );
};

const icingLocationMap: Record<keyof IcingColorDetails, string> = {
    side: 'Side Icing Color',
    top: 'Top Icing Color',
    borderTop: 'Top Border Color',
    borderBase: 'Base Border Color',
    drip: 'Drip Color',
    gumpasteBaseBoardColor: 'Base Board Color',
};

const guideIconClassName = "w-12 h-12 shrink-0 object-contain";
const icingLocationIconMap: Record<string, React.ReactNode> = {
    side: <SideIcingGuideIcon className={guideIconClassName} />,
    top: <TopIcingGuideIcon className={guideIconClassName} />,
    borderTop: <TopBorderGuideIcon className={guideIconClassName} />,
    borderBase: <BaseBorderGuideIcon className={guideIconClassName} />,
    gumpasteBaseBoard: <BaseBoardGuideIcon className={guideIconClassName} />,
};

const originalTypeLabelMap: Record<MainTopperType, string> = {
    'edible_3d': 'Edible',
    'figurine': 'Figurine',
    'toy': 'Toy',
    'cardstock': 'Cardstock',
    'edible_photo': 'Edible Photo',
    'printout': 'Printout',
    'edible_2d_gumpaste': '2D Edible'
};

const supportTypeLabelMap: Record<SupportElementType, string> = {
    'gumpaste_panel': 'Gumpaste Panel',
    'chocolates': 'Chocolates',
    'sprinkles': 'Sprinkles',
    'support_printout': 'Printout',
    'isomalt': 'Isomalt',
    'small_gumpaste': 'Small Gumpaste',
    'dragees': 'Dragees',
    'edible_flowers': 'Edible Flowers',
    'edible_photo_side': 'Edible Photo Side'
};

const GumpasteTypesForColoring: Array<MainTopperType | SupportElementType> = [
    'edible_3d', 
    'edible_2d_gumpaste', 
    'small_gumpaste',
    'gumpaste_panel',
    'edible_flowers'
];

export const FeatureList = React.memo<FeatureListProps>(({
    analysisError, analysisId, cakeInfo, basePriceOptions, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
    onCakeInfoChange, onMainTopperChange, onSupportElementChange, onCakeMessageChange, onIcingDesignChange, onAdditionalInstructionsChange, onTopperImageReplace, onSupportElementImageReplace,
    isAnalyzing,
    hideBaseOptions = false,
    hideSupportElements = false,
    onAddPrintoutTopper,
    onSetPrimaryMessage,
    primaryMessage,
    onSetBaseBoardMessage,
    baseBoardMessage,
    defaultOpenInstructions = false,
    shopifyFixedSize,
    shopifyBasePrice,
}) => {
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const cakeTypeScrollContainerRef = useRef<HTMLDivElement>(null);
    const [showAdditionalInstructions, setShowAdditionalInstructions] = useState(defaultOpenInstructions || !!additionalInstructions);
    const prevAnalysisIdRef = useRef(analysisId);
    const [editingColorForItemId, setEditingColorForItemId] = useState<string | null>(null);

    // Get user authentication to check if admin
    const { user } = useAuth();
    const isAdmin = user?.email === 'apcaballes@gmail.com';

    const mainToppersCount = mainToppers.reduce((sum, topper) => sum + topper.quantity, 0);
    const supportElementsCount = supportElements.length;

    useEffect(() => {
        if (analysisId !== prevAnalysisIdRef.current) {
            if (!defaultOpenInstructions) {
                setShowAdditionalInstructions(false);
            }
            prevAnalysisIdRef.current = analysisId;
        }
    }, [analysisId, defaultOpenInstructions]);

    const originalIcingColors = useRef<IcingColorDetails | null>(null);

    useEffect(() => {
        if (analysisId && icingDesign) {
            // When a new analysis ID appears, capture the initial icing colors as the reference.
            originalIcingColors.current = { ...icingDesign.colors };
        }
        // This should only run when analysisId changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisId]);

    if (analysisError) return <div className="text-center p-4 bg-red-50 rounded-lg text-red-700"><p className="font-semibold">Analysis Failed</p><p className="text-sm">{analysisError}</p></div>;
    if (!icingDesign || !cakeInfo) return null;

    const currentThicknessOptions = THICKNESS_OPTIONS_MAP[cakeInfo.type] || [];
    
    const tierCount = cakeInfo.flavors.length;
    const tierLabels =
        tierCount === 2 ? ['Top Tier Flavor', 'Bottom Tier Flavor'] :
        tierCount === 3 ? ['Top Tier Flavor', 'Middle Tier Flavor', 'Bottom Tier Flavor'] :
        ['Cake Flavor'];

    const canAddBaseBoardMessage = !cakeMessages.some(m => m.position === 'base_board');
    const isBento = cakeInfo.type === 'Bento';

    const handleAddNewBaseBoardMessage = () => {
        const newMessage: CakeMessageUI = {
            id: crypto.randomUUID(),
            isEnabled: true,
            price: 0,
            type: 'icing_script',
            text: 'Happy Birthday',
            position: 'base_board',
            color: '#000000',
        };
        onCakeMessageChange([...cakeMessages, newMessage]);
    };

    return (
        <div className="space-y-4">
            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
                .animate-fade-in-fast { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
            <h2 className="text-xl font-bold text-slate-800 text-center">Customize Your Cake</h2>
            
             <Section title="Cake Base" defaultOpen={!isAnalyzing} analysisText={isAnalyzing ? 'analyzing base...' : undefined}>
                {isAnalyzing ? <CakeBaseSkeleton /> : (
                <div className="bg-white p-3 rounded-md border border-slate-200 space-y-4">
                    {shopifyFixedSize && shopifyBasePrice !== undefined && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Size & Base Price</label>
                            <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex items-center justify-between">
                                <span className="text-sm font-semibold text-purple-800">{shopifyFixedSize}</span>
                                <span className="text-sm font-bold text-purple-800">₱{shopifyBasePrice.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                    {!hideBaseOptions && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Cake Type</label>
                                <div className="relative">
                                    <div ref={cakeTypeScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                                        {CAKE_TYPES.map(type => (
                                            <button
                                                key={type}
                                                data-caketype={type}
                                                type="button"
                                                onClick={() => onCakeInfoChange({ type })}
                                                className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                                            >
                                                <div className={`w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                                                    cakeInfo.type === type
                                                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                                        : 'border-slate-200 bg-white group-hover:border-purple-400'
                                                }`}>
                                                    <img 
                                                        src={CAKE_TYPE_THUMBNAILS[type]} 
                                                        alt={cakeTypeDisplayMap[type]} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                </div>
                                                <span className="mt-2 text-xs font-medium text-slate-700 leading-tight">{cakeTypeDisplayMap[type]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Cake Height (All tiers)</label>
                                <div className="relative">
                                    <div className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                                        {currentThicknessOptions.map(thickness => (
                                            <button
                                                key={thickness}
                                                type="button"
                                                onClick={() => onCakeInfoChange({ thickness })}
                                                className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                                            >
                                                <div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                                                    cakeInfo.thickness === thickness
                                                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                                        : 'border-slate-200 bg-white group-hover:border-purple-400'
                                                }`}>
                                                    <img 
                                                        src={CAKE_THICKNESS_THUMBNAILS[thickness]} 
                                                        alt={`${thickness} height`}
                                                        className="w-full h-full object-cover" 
                                                    />
                                                </div>
                                                <span className="mt-2 text-xs font-semibold text-slate-800 leading-tight">{thickness}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {basePriceOptions && basePriceOptions.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Size (Diameter)</label>
                            {basePriceOptions.length === 1 ? (
                                <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex items-center justify-between">
                                    <span className="text-sm font-semibold text-purple-800">{basePriceOptions[0].size}</span>
                                    <span className="text-sm font-bold text-purple-800">₱{basePriceOptions[0].price.toLocaleString()}</span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                                        {basePriceOptions.map(option => (
                                            <button
                                                key={option.size}
                                                type="button"
                                                onClick={() => onCakeInfoChange({ size: option.size })}
                                                className="group flex-shrink-0 w-28 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                                            >
                                                <div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                                                    cakeInfo.size === option.size
                                                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                                        : 'border-slate-200 bg-white group-hover:border-purple-400'
                                                }`}>
                                                    <img 
                                                        src={CAKE_SIZE_THUMBNAILS[option.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]} 
                                                        alt={option.size} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                    <div className="absolute inset-x-0 top-0 pt-4 text-black text-[10px] font-bold text-center leading-tight">
                                                        {(() => {
                                                            const sizePart = option.size.split(' ')[0];
                                                            const tiers = sizePart.match(/\d+"/g) || [];
                                                            return (
                                                                <div>
                                                                    {tiers.map((tier, index) => (
                                                                        <React.Fragment key={index}>
                                                                            <span>&lt;- {tier} -&gt;</span>
                                                                            <br />
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <span className="mt-2 text-xs font-semibold text-slate-800 leading-tight">{option.size}</span>
                                                <span className="text-xs text-slate-500">₱{option.price.toLocaleString()}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-3 pt-4 border-t border-slate-200">
                         {tierLabels.map((label, index) => {
                            const tierThumbnailUrl = TIER_THUMBNAILS[tierCount]?.[index];
                            return (
                                <div key={index} className="bg-white p-3 rounded-md border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        {tierThumbnailUrl && (
                                            <img src={tierThumbnailUrl} alt={`Tier ${index + 1}`} className="w-12 h-12 object-contain rounded-md" />
                                        )}
                                        <span className="text-sm font-medium text-slate-800">{label}</span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <div className="relative">
                                            <div className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide">
                                                {FLAVOR_OPTIONS.map(flavor => (
                                                    <button
                                                        key={flavor}
                                                        type="button"
                                                        onClick={() => {
                                                            const newFlavors = [...cakeInfo.flavors];
                                                            newFlavors[index] = flavor;
                                                            onCakeInfoChange({ flavors: newFlavors });
                                                        }}
                                                        className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                                                    >
                                                        <div className={`w-full aspect-square rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                                                            cakeInfo.flavors[index] === flavor
                                                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                                                : 'border-slate-200 bg-white group-hover:border-purple-400'
                                                        }`}>
                                                            <img 
                                                                src={FLAVOR_THUMBNAILS[flavor]} 
                                                                alt={flavor} 
                                                                className="w-full h-full object-cover" 
                                                            />
                                                        </div>
                                                        <span className="mt-2 text-xs font-medium text-slate-700 leading-tight">{flavor}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}
            </Section>

            <Section title="Main Toppers" count={isAnalyzing && mainToppers.length === 0 ? undefined : mainToppersCount} defaultOpen={!isAnalyzing} analysisText={isAnalyzing && mainToppers.length === 0 ? 'analyzing toppers...' : undefined}>
                {isAnalyzing && mainToppers.length === 0 ? (
                    <div className="space-y-2 animate-fade-in-fast">
                        <p className="text-xs text-slate-500 text-center pb-2">Analyzing for main toppers...</p>
                        <ToggleSkeleton />
                        <ToggleSkeleton />
                    </div>
                ) : mainToppers.length > 0 ? (
                    <GroupedItems
                        items={mainToppers}
                        renderItem={(topper: MainTopperUI) => {
                            const is3DFlower = topper.original_type === 'edible_3d' && topper.description.toLowerCase().includes('flower');
                            const showMaterialToggle = (topper.original_type !== 'printout' && !is3DFlower) || topper.original_type === 'edible_photo';
                            const isPrintoutOrPhoto = topper.type === 'printout' || topper.type === 'edible_photo';
                            const canChangeColor = GumpasteTypesForColoring.includes(topper.original_type) && topper.original_color;

                            const hasOptions = showMaterialToggle || isPrintoutOrPhoto || canChangeColor;
                            
                            return (
                            <Toggle
                                key={topper.id}
                                label={`${topper.description} (${topper.size})`}
                                isEnabled={topper.isEnabled}
                                price={topper.price}
                                showPrice={isAdmin}
                                onDelete={() => onMainTopperChange(mainToppers.filter(t => t.id !== topper.id))}
                                onChange={(isEnabled) => onMainTopperChange(mainToppers.map(t => t.id === topper.id ? { ...t, isEnabled } : t))}
                            >
                               {hasOptions && (
                                   <div className="mt-3 pt-3 border-t border-slate-200 space-y-4">
                                       {showMaterialToggle && (
                                           <div>
                                               <label className="block text-xs font-medium text-slate-600 mb-2">Material Type</label>
                                               <div className="flex space-x-1 bg-slate-100 p-1 rounded-md">
                                                   <button 
                                                       onClick={() => onMainTopperChange(mainToppers.map(t => t.id === topper.id ? { ...t, type: topper.original_type } : t))} 
                                                       className={`px-3 py-2 text-sm font-semibold rounded ${topper.type === topper.original_type ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>
                                                       {originalTypeLabelMap[topper.original_type]}
                                                   </button>
                                                   <button 
                                                       onClick={() => onMainTopperChange(mainToppers.map(t => t.id === topper.id ? { ...t, type: 'printout' } : t))} 
                                                       className={`px-3 py-2 text-sm font-semibold rounded ${topper.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>
                                                       Printout
                                                   </button>
                                               </div>
                                           </div>
                                       )}
                                       {isPrintoutOrPhoto && (
                                           <div>
                                               <label className="block text-xs font-medium text-slate-600 mb-2">Replacement Image</label>
                                                <div className="flex items-center">
                                                   <button
                                                       type="button"
                                                       onClick={() => fileInputRefs.current[topper.id]?.click()}
                                                       className="text-xs bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-md hover:bg-slate-300 transition-colors flex items-center"
                                                   >
                                                       <PhotoIcon className="w-4 h-4 mr-1.5"/>
                                                       {topper.replacementImage ? 'Change Image' : 'Replace Image'}
                                                   </button>
                                                   {topper.replacementImage && <span className="text-xs ml-2 text-green-600 font-medium">Image selected</span>}
                                                   <input
                                                       type="file"
                                                       ref={el => { fileInputRefs.current[topper.id] = el; }}
                                                       className="hidden"
                                                       accept="image/*"
                                                       onChange={(e) => {
                                                           if (e.target.files?.[0]) {
                                                               onTopperImageReplace(topper.id, e.target.files[0]);
                                                           }
                                                       }}
                                                   />
                                               </div>
                                           </div>
                                       )}
                                       {canChangeColor && (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
                                                {editingColorForItemId === topper.id ? (
                                                    <div className="animate-fade-in-fast">
                                                        <ColorPalette
                                                            selectedColor={topper.color || ''}
                                                            onColorChange={(newHex) => {
                                                                onMainTopperChange(mainToppers.map(t => t.id === topper.id ? { ...t, color: newHex } : t));
                                                                setEditingColorForItemId(null);
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: topper.color || '#FFFFFF' }}></div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingColorForItemId(topper.id)}
                                                            className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50"
                                                        >
                                                            <PencilIcon className="w-3 h-3" />
                                                            Change
                                                        </button>
                                                    </div>
                                                )}
                                           </div>
                                       )}
                                  </div>
                               )}
                            </Toggle>
                        )}}
                    />
                ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No main toppers detected.</p>
                )}
                {onAddPrintoutTopper && (
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={onAddPrintoutTopper}
                            className="w-full text-center bg-white border border-dashed border-slate-400 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                        >
                            + Add Printout Topper
                        </button>
                    </div>
                )}
            </Section>
            
            {!hideSupportElements && (
                <Section title="Support Elements" count={isAnalyzing && supportElements.length === 0 ? undefined : supportElementsCount} defaultOpen={!isAnalyzing} analysisText={isAnalyzing && supportElements.length === 0 ? 'analyzing elements...' : undefined}>
                    {isAnalyzing && supportElements.length === 0 ? (
                        <div className="space-y-2 animate-fade-in-fast">
                            <p className="text-xs text-slate-500 text-center pb-2">Analyzing for support elements...</p>
                            <ToggleSkeleton />
                        </div>
                    ) : supportElements.length > 0 ? (
                        <GroupedItems
                             items={supportElements}
                             renderItem={(element: SupportElementUI) => {
                                const isSwitchableToPrintout = element.original_type === 'edible_photo_side';
                                const isPrintoutOrPhoto = element.type === 'support_printout' || element.type === 'edible_photo_side';
                                const canChangeColor = GumpasteTypesForColoring.includes(element.original_type) && element.original_color;

                                const hasOptions = isSwitchableToPrintout || isPrintoutOrPhoto || canChangeColor;
                                
                                return (
                                 <Toggle
                                    key={element.id}
                                    label={`${element.description} (${element.coverage})`}
                                    isEnabled={element.isEnabled}
                                    price={element.price}
                                    showPrice={isAdmin}
                                    onChange={(isEnabled) => onSupportElementChange(supportElements.map(e => e.id === element.id ? { ...e, isEnabled } : e))}
                                 >
                                    {hasOptions && (
                                       <div className="mt-3 pt-3 border-t border-slate-200 space-y-4">
                                           {isSwitchableToPrintout && (
                                               <div>
                                                   <label className="block text-xs font-medium text-slate-600 mb-2">Material Type</label>
                                                   <div className="flex space-x-1 bg-slate-100 p-1 rounded-md">
                                                       <button 
                                                           onClick={() => onSupportElementChange(supportElements.map(e => e.id === element.id ? { ...e, type: 'edible_photo_side' } : e))} 
                                                           className={`px-3 py-2 text-sm font-semibold rounded ${element.type === 'edible_photo_side' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>
                                                           Edible Photo Wrap
                                                       </button>
                                                       <button 
                                                           onClick={() => onSupportElementChange(supportElements.map(e => e.id === element.id ? { ...e, type: 'support_printout' } : e))} 
                                                           className={`px-3 py-2 text-sm font-semibold rounded ${element.type === 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>
                                                           Printout Wrap
                                                       </button>
                                                   </div>
                                               </div>
                                           )}
                                           {isPrintoutOrPhoto && (
                                               <div>
                                                   <label className="block text-xs font-medium text-slate-600 mb-2">Replacement Image</label>
                                                    <div className="flex items-center">
                                                       <button
                                                           type="button"
                                                           onClick={() => fileInputRefs.current[element.id]?.click()}
                                                           className="text-xs bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-md hover:bg-slate-300 transition-colors flex items-center"
                                                       >
                                                           <PhotoIcon className="w-4 h-4 mr-1.5"/>
                                                           {element.replacementImage ? 'Change Image' : 'Replace Image'}
                                                       </button>
                                                       {element.replacementImage && <span className="text-xs ml-2 text-green-600 font-medium">Image selected</span>}
                                                       <input
                                                           type="file"
                                                           ref={el => { fileInputRefs.current[element.id] = el; }}
                                                           className="hidden"
                                                           accept="image/*"
                                                           onChange={(e) => {
                                                               if (e.target.files?.[0]) {
                                                                   onSupportElementImageReplace(element.id, e.target.files[0]);
                                                               }
                                                           }}
                                                       />
                                                   </div>
                                               </div>
                                           )}
                                           {canChangeColor && (
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
                                                    {editingColorForItemId === element.id ? (
                                                        <div className="animate-fade-in-fast">
                                                            <ColorPalette
                                                                selectedColor={element.color || ''}
                                                                onColorChange={(newHex) => {
                                                                    onSupportElementChange(supportElements.map(e => e.id === element.id ? { ...e, color: newHex } : e));
                                                                    setEditingColorForItemId(null);
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: element.color || '#FFFFFF' }}></div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingColorForItemId(element.id)}
                                                                className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50"
                                                            >
                                                                <PencilIcon className="w-3 h-3" />
                                                                Change
                                                            </button>
                                                        </div>
                                                    )}
                                               </div>
                                           )}
                                      </div>
                                    )}
                                 </Toggle>
                             )}}
                        />
                    ) : (
                        <p className="text-sm text-slate-500 text-center py-4">No support elements detected.</p>
                    )}
                </Section>
            )}
            
            <Section title="Cake Messages" defaultOpen={!isAnalyzing} analysisText={isAnalyzing && cakeMessages.length === 0 ? 'analyzing messages...' : undefined}>
                {onSetPrimaryMessage && onSetBaseBoardMessage ? (
                    <div className="space-y-3">
                        <div className="bg-white p-3 rounded-md border border-slate-200">
                            <label htmlFor="primary-message-text" className="block text-sm font-medium text-slate-700 mb-2">
                                Change Message To
                            </label>
                            <div className="relative">
                                <input
                                    id="primary-message-text"
                                    type="text"
                                    value={primaryMessage?.text || ''}
                                    onChange={(e) => onSetPrimaryMessage({ text: e.target.value })}
                                    className="w-full pl-4 pr-10 py-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    placeholder="e.g., Happy Birthday!"
                                />
                                <PencilIcon className="absolute top-1/2 right-3 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                                <div className="flex justify-between items-center">
                                    <label htmlFor="primary-message-default-color-toggle" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        Use Default Color
                                        <span className="text-xs text-slate-500 font-normal">(Inherits original style)</span>
                                    </label>
                                    <button
                                        type="button"
                                        id="primary-message-default-color-toggle"
                                        onClick={() => onSetPrimaryMessage({ useDefaultColor: !(primaryMessage?.useDefaultColor ?? true) })}
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${(primaryMessage?.useDefaultColor ?? true) ? 'bg-purple-600' : 'bg-slate-300'}`}
                                        aria-pressed={primaryMessage?.useDefaultColor ?? true}
                                    >
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${(primaryMessage?.useDefaultColor ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {!(primaryMessage?.useDefaultColor ?? true) && (
                                    <div className="animate-fade-in-fast pt-3 border-t border-slate-100 mt-3">
                                        <label className="block text-xs font-medium text-slate-600 mb-2">Custom Color</label>
                                        <ColorPalette
                                            selectedColor={primaryMessage?.color || '#000000'}
                                            onColorChange={(newHex) => onSetPrimaryMessage({ color: newHex })}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-md border border-slate-200">
                            <label htmlFor="base-board-message-text" className="block text-sm font-medium text-slate-700 mb-2">
                                Add Message (Base Board)
                            </label>
                            <div className="relative">
                                <input
                                    id="base-board-message-text"
                                    type="text"
                                    value={baseBoardMessage?.text || ''}
                                    onChange={(e) => onSetBaseBoardMessage?.({ text: e.target.value })}
                                    className="w-full pl-4 pr-10 py-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                    placeholder="Message for the cake board"
                                />
                                <PencilIcon className="absolute top-1/2 right-3 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                            </div>
                           <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                                <div className="flex justify-between items-center">
                                    <label htmlFor="baseboard-message-default-color-toggle" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        Use Default Color
                                        <span className="text-xs text-slate-500 font-normal">(Contrasting color)</span>
                                    </label>
                                    <button
                                        type="button"
                                        id="baseboard-message-default-color-toggle"
                                        onClick={() => onSetBaseBoardMessage({ useDefaultColor: !(baseBoardMessage?.useDefaultColor ?? true) })}
                                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${(baseBoardMessage?.useDefaultColor ?? true) ? 'bg-purple-600' : 'bg-slate-300'}`}
                                        aria-pressed={baseBoardMessage?.useDefaultColor ?? true}
                                    >
                                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${(baseBoardMessage?.useDefaultColor ?? true) ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {!(baseBoardMessage?.useDefaultColor ?? true) && (
                                    <div className="animate-fade-in-fast pt-3 border-t border-slate-100 mt-3">
                                        <label className="block text-xs font-medium text-slate-600 mb-2">Custom Color</label>
                                        <ColorPalette
                                            selectedColor={baseBoardMessage?.color || '#000000'}
                                            onColorChange={(newHex) => onSetBaseBoardMessage({ color: newHex })}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : isAnalyzing && cakeMessages.length === 0 ? (
                    <div className="space-y-2 animate-fade-in-fast">
                        <p className="text-xs text-slate-500 text-center pb-2">Checking for messages...</p>
                        <ToggleSkeleton />
                    </div>
                ) : (
                    <>
                        {cakeMessages.length > 0 ? (
                            cakeMessages.map(message => (
                                <Toggle
                                    key={message.id}
                                    label={`Message: "${message.text}"`}
                                    isEnabled={message.isEnabled}
                                    onChange={(isEnabled) => onCakeMessageChange(cakeMessages.map(m => m.id === message.id ? { ...m, isEnabled } : m))}
                                    onDelete={() => onCakeMessageChange(cakeMessages.filter(m => m.id !== message.id))}
                                >
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor={`message-text-${message.id}`} className="block text-xs font-medium text-slate-600 mb-1">
                                                Message Text
                                            </label>
                                            <div className="relative">
                                                <input
                                                    id={`message-text-${message.id}`}
                                                    type="text"
                                                    value={message.text}
                                                    onChange={(e) => onCakeMessageChange(cakeMessages.map(m => m.id === message.id ? { ...m, text: e.target.value } : m))}
                                                    className="w-full pl-4 pr-10 py-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                                    placeholder="Enter cake message"
                                                />
                                                <PencilIcon className="absolute top-1/2 right-3 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
                                            {editingColorForItemId === message.id ? (
                                                <div className="animate-fade-in-fast">
                                                    <ColorPalette
                                                        selectedColor={message.color}
                                                        onColorChange={(hex) => {
                                                            onCakeMessageChange(cakeMessages.map(m => m.id === message.id ? { ...m, color: hex } : m));
                                                            setEditingColorForItemId(null);
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: message.color || '#FFFFFF' }}></div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingColorForItemId(message.id)}
                                                        className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50"
                                                    >
                                                        <PencilIcon className="w-3 h-3" />
                                                        Change
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Toggle>
                            ))
                        ) : (
                           <p className="text-sm text-slate-500 text-center py-4">No messages detected.</p>
                        )}
                        {canAddBaseBoardMessage && (
                            <div className="mt-3 relative group">
                                <button
                                    type="button"
                                    onClick={!isBento ? handleAddNewBaseBoardMessage : undefined}
                                    disabled={isBento}
                                    className="w-full text-center bg-white border border-dashed border-slate-400 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
                                >
                                    + Add Cake Message (base board)
                                </button>
                                 {isBento && (
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs px-2 py-1 bg-slate-700 text-white text-xs rounded-md invisible group-hover:visible transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                                        Not available for Bento cakes
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </Section>

            {icingDesign && (
                <Section title="Icing & Design">
                    <div className="space-y-3">
                         <Toggle
                            label="Drip Effect"
                            icon={<img src={DRIP_THUMBNAIL_URL} alt="Drip effect" className="w-12 h-12 object-contain rounded-md" />}
                            isEnabled={icingDesign.drip}
                            price={icingDesign.dripPrice}
                            showPrice={isAdmin}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, drip: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.drip) {
                                    newIcingDesign.colors = { ...newIcingDesign.colors, drip: '#FFFFFF' };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                            <div className="mt-3 pt-3 border-t border-slate-200">
                                <label className="block text-xs font-medium text-slate-600 mb-2">Drip Color</label>
                                 {editingColorForItemId === 'icing-drip' ? (
                                    <div className="animate-fade-in-fast">
                                        <ColorPalette
                                            selectedColor={icingDesign.colors.drip || '#FFFFFF'}
                                            onColorChange={(newHex) => {
                                                const newColors = { ...icingDesign.colors, drip: newHex };
                                                onIcingDesignChange({ ...icingDesign, colors: newColors });
                                                setEditingColorForItemId(null);
                                            }}
                                        />
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: icingDesign.colors.drip || '#FFFFFF' }}></div>
                                        <button
                                            type="button"
                                            onClick={() => setEditingColorForItemId('icing-drip')}
                                            className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50"
                                        >
                                            <PencilIcon className="w-3 h-3" />
                                            Change
                                        </button>
                                    </div>
                                 )}
                            </div>
                         </Toggle>
                        
                        {/* Side Icing Color */}
                        <div className="bg-white p-3 rounded-md border border-slate-200">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {icingLocationIconMap['side']}
                                    <span className="text-sm font-medium text-slate-800">{icingLocationMap['side']}</span>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200">
                                {(() => {
                                    const originalColor = originalIcingColors.current?.side;
                                    const currentColor = icingDesign.colors.side;
                                    const isCustomized = currentColor !== originalColor;

                                    return editingColorForItemId === 'icing-side' ? (
                                        <div className="animate-fade-in-fast">
                                            <ColorPalette
                                                selectedColor={currentColor || '#FFFFFF'}
                                                onColorChange={(newHex) => {
                                                    const newColors = { ...icingDesign.colors, side: newHex };
                                                    onIcingDesignChange({ ...icingDesign, colors: newColors });
                                                    setEditingColorForItemId(null);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: currentColor || '#FFFFFF' }}></div>
                                                <button type="button" onClick={() => setEditingColorForItemId('icing-side')} className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50">
                                                    <PencilIcon className="w-3 h-3" />
                                                    Change
                                                </button>
                                            </div>
                                            {isCustomized && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newColors = { ...icingDesign.colors };
                                                        if (originalColor === undefined) {
                                                          delete newColors.side;
                                                        } else {
                                                          newColors.side = originalColor;
                                                        }
                                                        onIcingDesignChange({ ...icingDesign, colors: newColors });
                                                    }}
                                                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                                                >
                                                    Revert
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Top Icing Color */}
                        <div className="bg-white p-3 rounded-md border border-slate-200">
                           <div className="flex justify-between items-center">
                               <div className="flex items-center gap-3">
                                   {icingLocationIconMap['top']}
                                   <span className="text-sm font-medium text-slate-800">{icingLocationMap['top']}</span>
                               </div>
                           </div>
                           <div className="mt-3 pt-3 border-t border-slate-200">
                                {(() => {
                                    const originalColor = originalIcingColors.current?.top;
                                    const currentColor = icingDesign.colors.top;
                                    const isCustomized = currentColor !== originalColor;

                                    return editingColorForItemId === 'icing-top' ? (
                                        <div className="animate-fade-in-fast">
                                            <ColorPalette
                                                selectedColor={currentColor || '#FFFFFF'}
                                                onColorChange={(newHex) => {
                                                    const newColors = { ...icingDesign.colors, top: newHex };
                                                    onIcingDesignChange({ ...icingDesign, colors: newColors });
                                                    setEditingColorForItemId(null);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: currentColor || '#FFFFFF' }}></div>
                                                <button type="button" onClick={() => setEditingColorForItemId('icing-top')} className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50">
                                                    <PencilIcon className="w-3 h-3" />
                                                    Change
                                                </button>
                                            </div>
                                            {isCustomized && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newColors = { ...icingDesign.colors };
                                                        if (originalColor === undefined) {
                                                          delete newColors.top;
                                                        } else {
                                                          newColors.top = originalColor;
                                                        }
                                                        onIcingDesignChange({ ...icingDesign, colors: newColors });
                                                    }}
                                                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                                                >
                                                    Revert
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                           </div>
                        </div>

                        <Toggle
                            label="Top Border"
                            icon={icingLocationIconMap['borderTop']}
                            isEnabled={icingDesign.border_top}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, border_top: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.borderTop) {
                                    // Set border color to match the top icing color for accuracy
                                    const defaultColor = icingDesign.colors.top || icingDesign.colors.side || '#FFFFFF';
                                    newIcingDesign.colors = { ...newIcingDesign.colors, borderTop: defaultColor };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                             {icingDesign.colors.borderTop && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-2">{icingLocationMap['borderTop']}</label>
                                    {editingColorForItemId === 'icing-borderTop' ? (
                                        <div className="animate-fade-in-fast">
                                            <ColorPalette
                                                selectedColor={icingDesign.colors.borderTop}
                                                onColorChange={(newHex) => {
                                                    onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, borderTop: newHex } });
                                                    setEditingColorForItemId(null);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: icingDesign.colors.borderTop }}></div>
                                            <button type="button" onClick={() => setEditingColorForItemId('icing-borderTop')} className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50"><PencilIcon className="w-3 h-3" />Change</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Toggle>
                        
                        <Toggle
                            label="Base Border"
                            icon={icingLocationIconMap['borderBase']}
                            isEnabled={icingDesign.border_base}
                            disabled={isBento}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, border_base: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.borderBase) {
                                    // Set border color to match the side icing color for accuracy
                                    const defaultColor = icingDesign.colors.side || icingDesign.colors.top || '#FFFFFF';
                                    newIcingDesign.colors = { ...newIcingDesign.colors, borderBase: defaultColor };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                            {icingDesign.colors.borderBase && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <label className="block text-xs font-medium text-slate-600 mb-2">{icingLocationMap['borderBase']}</label>
                                    {editingColorForItemId === 'icing-borderBase' ? (
                                        <div className="animate-fade-in-fast">
                                            <ColorPalette
                                                selectedColor={icingDesign.colors.borderBase}
                                                onColorChange={(newHex) => {
                                                    onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, borderBase: newHex } });
                                                    setEditingColorForItemId(null);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: icingDesign.colors.borderBase }}></div>
                                            <button type="button" onClick={() => setEditingColorForItemId('icing-borderBase')} className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50"><PencilIcon className="w-3 h-3" />Change</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Toggle>

                        <Toggle
                            label="Gumpaste Covered Board"
                            icon={icingLocationIconMap['gumpasteBaseBoard']}
                            isEnabled={icingDesign.gumpasteBaseBoard}
                            price={icingDesign.gumpasteBaseBoardPrice}
                            showPrice={isAdmin}
                            disabled={isBento}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, gumpasteBaseBoard: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.gumpasteBaseBoardColor) {
                                    newIcingDesign.colors = { ...newIcingDesign.colors, gumpasteBaseBoardColor: '#FFFFFF' };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                           <div className="mt-3 pt-3 border-t border-slate-200">
                                 <label className="block text-xs font-medium text-slate-600 mb-2">{icingLocationMap['gumpasteBaseBoardColor']}</label>
                                 {editingColorForItemId === 'icing-gumpasteBaseBoardColor' ? (
                                     <div className="animate-fade-in-fast">
                                         <ColorPalette
                                             selectedColor={icingDesign.colors.gumpasteBaseBoardColor || '#FFFFFF'}
                                             onColorChange={(newHex) => {
                                                 onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, gumpasteBaseBoardColor: newHex } });
                                                 setEditingColorForItemId(null);
                                             }}
                                         />
                                     </div>
                                 ) : (
                                    <div className="flex items-center gap-2">
                                         <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: icingDesign.colors.gumpasteBaseBoardColor || '#FFFFFF' }}></div>
                                         <button type="button" onClick={() => setEditingColorForItemId('icing-gumpasteBaseBoardColor')} className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 rounded-md hover:bg-purple-50"><PencilIcon className="w-3 h-3" />Change</button>
                                    </div>
                                 )}
                            </div>
                        </Toggle>
                    </div>
                </Section>
            )}
             <Section title="Additional Instructions" defaultOpen={true}>
                {showAdditionalInstructions ? (
                    <div className="relative animate-fade-in-fast">
                        <textarea
                            value={additionalInstructions}
                            onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
                            className="w-full p-3 pr-10 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Provide specific notes here, e.g., 'Make the unicorn horn gold,' 'Position the message on the left side.' IMPORTANT: Do not use this to add new items."
                            rows={4}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                onAdditionalInstructionsChange('');
                                setShowAdditionalInstructions(false);
                            }}
                            className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                            aria-label="Remove instructions"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                        <p className="text-xs text-slate-500 mt-2">
                            <strong>Note:</strong> Use this field for clarifications on existing items (color, position, etc.). Instructions to <strong>add new toppers</strong> will be ignored.
                        </p>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowAdditionalInstructions(true)}
                        className="w-full text-center bg-white border border-dashed border-slate-400 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                        + Add Additional Instructions
                    </button>
                )}
             </Section>
        </div>
    );
});
FeatureList.displayName = 'FeatureList';
