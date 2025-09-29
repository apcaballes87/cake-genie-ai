import React, { useState, useRef, useEffect } from 'react';
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, MainTopperType, CakeInfoUI, CakeType, CakeThickness, CakeFlavor, BasePriceInfo } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { ChevronDownIcon, PhotoIcon, SideIcingGuideIcon, TopIcingGuideIcon, TopBorderGuideIcon, BaseBorderGuideIcon, PencilIcon, BaseBoardGuideIcon } from './icons';
import { ColorPalette } from './ColorPalette';
import { CAKE_TYPES, THICKNESS_OPTIONS_MAP, ANALYSIS_PHRASES, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS } from '../constants';

const DRIP_THUMBNAIL_URL = 'https://congofivupobtfudnhni.supabase.co/storage/v1/object/public/cakegenie/dripeffect.png';
const FLAVOR_OPTIONS: CakeFlavor[] = ['Chocolate Cake', 'Ube Cake', 'Vanilla Cake'];

interface FeatureListProps {
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisId: string | null;
  cakeInfo: CakeInfoUI | null;
  basePriceOptions: BasePriceInfo[] | null;
  mainToppers: MainTopperUI[];
  supportElements: SupportElementUI[];
  cakeMessages: CakeMessageUI[];
  icingDesign: IcingDesignUI | null;
  additionalInstructions: string;
  onCakeInfoChange: (updates: Partial<CakeInfoUI>) => void;
  onMainTopperChange: (toppers: MainTopperUI[]) => void;
  onSupportElementChange: (elements: SupportElementUI[]) => void;
  onCakeMessageChange: (message: CakeMessageUI[]) => void;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  onAdditionalInstructionsChange: (instructions: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => void;
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

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-slate-50 rounded-lg border border-slate-200">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
                <h3 className="font-semibold text-slate-700">{title}</h3>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="p-4 pt-0 space-y-3">{children}</div>}
        </div>
    );
};

const Toggle: React.FC<{ label: string; isEnabled: boolean; onChange: (enabled: boolean) => void; price?: number; children?: React.ReactNode; icon?: React.ReactNode }> = ({ label, isEnabled, onChange, price, children, icon }) => (
    <div className={`bg-white p-3 rounded-md border border-slate-200 transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-60'}`}>
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
                {icon}
                <span className={`text-sm font-medium ${isEnabled ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{label}</span>
            </div>
            <div className="flex items-center space-x-4">
                {price !== undefined && <span className={`font-semibold ${isEnabled ? 'text-green-600' : 'text-slate-400 line-through'}`}>₱{price}</span>}
                <button
                    type="button"
                    onClick={() => onChange(!isEnabled)}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}
                    aria-pressed={isEnabled}
                >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
        {isEnabled && children && <div className="mt-3">{children}</div>}
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
                // FIX: Add type guards to ensure group is an array and not empty before accessing its properties.
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

export const FeatureList: React.FC<FeatureListProps> = ({
    isAnalyzing, analysisError, analysisId, cakeInfo, basePriceOptions, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
    onCakeInfoChange, onMainTopperChange, onSupportElementChange, onCakeMessageChange, onIcingDesignChange, onAdditionalInstructionsChange, onTopperImageReplace
}) => {
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [analysisText, setAnalysisText] = useState(ANALYSIS_PHRASES[0]);
    const cakeTypeScrollContainerRef = useRef<HTMLDivElement>(null);

    // State for "Keep Original" toggles
    const [keepOriginal, setKeepOriginal] = useState({ side: true, top: true });
    const originalColors = useRef({ side: icingDesign?.colors.side, top: icingDesign?.colors.top });

    useEffect(() => {
      if (analysisId && icingDesign) {
          // New analysis detected, reset state to default "Keep Original" ON
          setKeepOriginal({ side: true, top: true });
          originalColors.current = { side: icingDesign.colors.side, top: icingDesign.colors.top };

          const newColors = { ...icingDesign.colors };
          let changed = false;
          if (Object.prototype.hasOwnProperty.call(newColors, 'side')) {
              delete newColors.side;
              changed = true;
          }
          if (Object.prototype.hasOwnProperty.call(newColors, 'top')) {
              delete newColors.top;
              changed = true;
          }
          if (changed) {
              onIcingDesignChange({ ...icingDesign, colors: newColors });
          }
      }
    // analysisId is a stable identifier for a new analysis result
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisId]);

    useEffect(() => {
        if (analysisId && cakeInfo?.type && cakeTypeScrollContainerRef.current) {
            // A small delay ensures the DOM is fully updated before we try to scroll.
            setTimeout(() => {
                const buttonToScrollTo = cakeTypeScrollContainerRef.current?.querySelector(`[data-caketype="${cakeInfo.type}"]`);
                if (buttonToScrollTo) {
                    buttonToScrollTo.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }
            }, 100);
        }
    }, [analysisId, cakeInfo?.type]);

    useEffect(() => {
        if (isAnalyzing) {
            setAnalysisText(ANALYSIS_PHRASES[0]); // Set initial text
            const intervalId = setInterval(() => {
                setAnalysisText(prevText => {
                    let newPhrase;
                    do {
                        newPhrase = ANALYSIS_PHRASES[Math.floor(Math.random() * ANALYSIS_PHRASES.length)];
                    } while (newPhrase === prevText);
                    return newPhrase;
                });
            }, 2500);

            return () => clearInterval(intervalId);
        }
    }, [isAnalyzing]);

    if (isAnalyzing) return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[10rem]">
            <LoadingSpinner />
            <p className="mt-4 text-slate-500 font-semibold text-center w-48">{analysisText}</p>
        </div>
    );
    if (analysisError) return <div className="text-center p-4 bg-red-50 rounded-lg text-red-700"><p className="font-semibold">Analysis Failed</p><p className="text-sm">{analysisError}</p></div>;
    if (!icingDesign || !cakeInfo) return null;

    const handleKeepOriginalToggle = (location: 'side' | 'top') => {
        if (!icingDesign) return;
        const isNowKeeping = !keepOriginal[location];
        setKeepOriginal(prev => ({ ...prev, [location]: isNowKeeping }));

        const newColors = { ...icingDesign.colors };
        if (isNowKeeping) {
            // When turning ON "Keep Original", remove the color override.
            delete newColors[location];
        } else {
            // When turning OFF "Keep Original", set a color.
            // Use the original color if available, otherwise default to white.
            newColors[location] = originalColors.current[location] || '#FFFFFF'; 
        }
        onIcingDesignChange({ ...icingDesign, colors: newColors });
    };

    const KeepOriginalToggle: React.FC<{ location: 'side' | 'top' }> = ({ location }) => {
        const isKeeping = keepOriginal[location];
        return (
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => handleKeepOriginalToggle(location)}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isKeeping ? 'bg-purple-600' : 'bg-slate-300'}`}
                    aria-pressed={isKeeping}
                >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isKeeping ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-xs font-medium ${isKeeping ? 'text-purple-700' : 'text-slate-500'}`}>Keep Original</span>
            </div>
        );
    };

    const currentThicknessOptions = THICKNESS_OPTIONS_MAP[cakeInfo.type] || [];
    
    const tierCount = cakeInfo.flavors.length;
    const tierLabels =
        tierCount === 2 ? ['Top Tier Flavor', 'Bottom Tier Flavor'] :
        tierCount === 3 ? ['Top Tier Flavor', 'Middle Tier Flavor', 'Bottom Tier Flavor'] :
        ['Cake Flavor'];

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
            `}</style>
            <h2 className="text-xl font-bold text-slate-800 text-center">Customize Your Cake</h2>
            
             <Section title="Cake Base">
                <div className="bg-white p-3 rounded-md border border-slate-200 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Cake Type</label>
                        <div className="relative">
                            <div ref={cakeTypeScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-4">
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

                    {basePriceOptions && basePriceOptions.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Size (Diameter)</label>
                            <div className="relative">
                                <div className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-4">
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
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                        <div>
                            <label htmlFor="cake-thickness" className="block text-sm font-medium text-slate-700 mb-1">Cake Height (All tiers)</label>
                            <select
                                id="cake-thickness"
                                value={cakeInfo.thickness}
                                onChange={(e) => onCakeInfoChange({ thickness: e.target.value as CakeThickness })}
                                className="w-full px-3 py-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            >
                               {currentThicknessOptions.map(thickness => <option key={thickness} value={thickness}>{thickness}</option>)}
                            </select>
                        </div>
                         {tierLabels.map((label, index) => (
                            <div key={index}>
                                <label htmlFor={`cake-flavor-${index}`} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                                <select
                                    id={`cake-flavor-${index}`}
                                    value={cakeInfo.flavors[index]}
                                    onChange={(e) => {
                                        const newFlavors = [...cakeInfo.flavors];
                                        newFlavors[index] = e.target.value as CakeFlavor;
                                        onCakeInfoChange({ flavors: newFlavors });
                                    }}
                                    className="w-full px-3 py-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                >
                                    {FLAVOR_OPTIONS.map(flavor => <option key={flavor} value={flavor}>{flavor}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            <Section title="Main Toppers" defaultOpen={false}>
                <GroupedItems
                    items={mainToppers}
                    renderItem={(topper: MainTopperUI) => {
                        const is3DFlower = topper.original_type === 'edible_3d' && topper.description.toLowerCase().includes('flower');
                        const showPrintoutToggle = topper.original_type !== 'printout' && !is3DFlower;

                        return (
                        <Toggle 
                            key={topper.id}
                            label={`${topper.description} (${topper.size})`}
                            isEnabled={topper.isEnabled}
                            price={topper.price}
                            onChange={(isEnabled) => onMainTopperChange(mainToppers.map(t => t.id === topper.id ? { ...t, isEnabled } : t))}
                        >
                           <div className="space-y-2">
                                {showPrintoutToggle && (
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
                                )}
                                {topper.type === 'printout' && (
                                     <div className="mt-2 flex items-center">
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
                                )}
                           </div>
                        </Toggle>
                    )}}
                />
            </Section>

            <Section title="Support Elements" defaultOpen={false}>
                <GroupedItems
                     items={supportElements}
                     renderItem={(element: SupportElementUI) => (
                         <Toggle
                            key={element.id}
                            label={`${element.description} (${element.coverage})`}
                            isEnabled={element.isEnabled}
                            price={element.price}
                            onChange={(isEnabled) => onSupportElementChange(supportElements.map(e => e.id === element.id ? { ...e, isEnabled } : e))}
                         />
                     )}
                />
            </Section>
            
            {cakeMessages.length > 0 && (
                <Section title="Cake Messages">
                    {cakeMessages.map(message => (
                        <Toggle
                            key={message.id}
                            label={`Message: "${message.text}"`}
                            isEnabled={message.isEnabled}
                            onChange={(isEnabled) => onCakeMessageChange(cakeMessages.map(m => m.id === message.id ? { ...m, isEnabled } : m))}
                        >
                            <div className="mb-2">
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
                            <ColorPalette
                                selectedColor={message.color}
                                onColorChange={(hex) => onCakeMessageChange(cakeMessages.map(m => m.id === message.id ? { ...m, color: hex } : m))}
                            />
                        </Toggle>
                    ))}
                </Section>
            )}

            {icingDesign && (
                <Section title="Icing & Design">
                    <div className="space-y-3">
                         <Toggle 
                            label="Drip Effect"
                            icon={<img src={DRIP_THUMBNAIL_URL} alt="Drip effect" className="w-12 h-12 object-contain rounded-md" />}
                            isEnabled={icingDesign.drip}
                            price={icingDesign.dripPrice}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, drip: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.drip) {
                                    newIcingDesign.colors = { ...newIcingDesign.colors, drip: '#FFFFFF' };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                            {icingDesign.colors.drip && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <ColorPalette
                                        selectedColor={icingDesign.colors.drip}
                                        onColorChange={(newHex) => {
                                            const newColors = { ...icingDesign.colors, drip: newHex };
                                            onIcingDesignChange({ ...icingDesign, colors: newColors });
                                        }}
                                    />
                                </div>
                            )}
                         </Toggle>
                        
                        {/* Side Icing Color */}
                        <div className="bg-white p-3 rounded-md border border-slate-200">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {icingLocationIconMap['side']}
                                    <span className="text-sm font-medium text-slate-800">{icingLocationMap['side']}</span>
                                </div>
                                <div className="hidden md:flex">
                                    <KeepOriginalToggle location="side" />
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className={`transition-opacity ${keepOriginal.side ? 'opacity-50' : ''}`}>
                                        <ColorPalette
                                            selectedColor={icingDesign.colors.side || ''}
                                            onColorChange={(newHex) => {
                                                if (keepOriginal.side) setKeepOriginal(prev => ({ ...prev, side: false }));
                                                const newColors = { ...icingDesign.colors, side: newHex };
                                                onIcingDesignChange({ ...icingDesign, colors: newColors });
                                            }}
                                        />
                                    </div>
                                    <div className="flex md:hidden pl-2 border-l border-slate-200">
                                        <KeepOriginalToggle location="side" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Icing Color */}
                        <div className="bg-white p-3 rounded-md border border-slate-200">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {icingLocationIconMap['top']}
                                    <span className="text-sm font-medium text-slate-800">{icingLocationMap['top']}</span>
                                </div>
                                <div className="hidden md:flex">
                                    <KeepOriginalToggle location="top" />
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className={`transition-opacity ${keepOriginal.top ? 'opacity-50' : ''}`}>
                                        <ColorPalette
                                            selectedColor={icingDesign.colors.top || ''}
                                            onColorChange={(newHex) => {
                                                if (keepOriginal.top) setKeepOriginal(prev => ({ ...prev, top: false }));
                                                const newColors = { ...icingDesign.colors, top: newHex };
                                                onIcingDesignChange({ ...icingDesign, colors: newColors });
                                            }}
                                        />
                                    </div>
                                    <div className="flex md:hidden pl-2 border-l border-slate-200">
                                        <KeepOriginalToggle location="top" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <Toggle 
                            label="Top Border"
                            icon={icingLocationIconMap['borderTop']}
                            isEnabled={icingDesign.border_top}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, border_top: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.borderTop) {
                                    newIcingDesign.colors = { ...newIcingDesign.colors, borderTop: '#FFFFFF' };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                             {icingDesign.colors.borderTop && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <ColorPalette
                                        selectedColor={icingDesign.colors.borderTop}
                                        onColorChange={(newHex) => {
                                            const newColors = { ...icingDesign.colors, borderTop: newHex };
                                            onIcingDesignChange({ ...icingDesign, colors: newColors });
                                        }}
                                    />
                                </div>
                            )}
                        </Toggle>
                        
                        <Toggle 
                            label="Base Border"
                            icon={icingLocationIconMap['borderBase']}
                            isEnabled={icingDesign.border_base}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, border_base: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.borderBase) {
                                    newIcingDesign.colors = { ...newIcingDesign.colors, borderBase: '#FFFFFF' };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                            {icingDesign.colors.borderBase && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <ColorPalette
                                        selectedColor={icingDesign.colors.borderBase}
                                        onColorChange={(newHex) => {
                                            const newColors = { ...icingDesign.colors, borderBase: newHex };
                                            onIcingDesignChange({ ...icingDesign, colors: newColors });
                                        }}
                                    />
                                </div>
                            )}
                        </Toggle>

                        <Toggle 
                            label="Gumpaste Covered Board"
                            icon={icingLocationIconMap['gumpasteBaseBoard']}
                            isEnabled={icingDesign.gumpasteBaseBoard}
                            onChange={(isEnabled) => {
                                const newIcingDesign = { ...icingDesign, gumpasteBaseBoard: isEnabled };
                                if (isEnabled && !newIcingDesign.colors.gumpasteBaseBoardColor) {
                                    newIcingDesign.colors = { ...newIcingDesign.colors, gumpasteBaseBoardColor: '#FFFFFF' };
                                }
                                onIcingDesignChange(newIcingDesign);
                            }}
                        >
                            {icingDesign.colors.gumpasteBaseBoardColor && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <ColorPalette
                                        selectedColor={icingDesign.colors.gumpasteBaseBoardColor}
                                        onColorChange={(newHex) => {
                                            const newColors = { ...icingDesign.colors, gumpasteBaseBoardColor: newHex };
                                            onIcingDesignChange({ ...icingDesign, colors: newColors });
                                        }}
                                    />
                                </div>
                            )}
                        </Toggle>
                    </div>
                </Section>
            )}
             <Section title="Additional Instructions" defaultOpen={false}>
                <div>
                    <textarea
                        value={additionalInstructions}
                        onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
                        className="w-full p-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Provide specific notes here, e.g., 'Make the unicorn horn gold,' 'Position the message on the left side.' IMPORTANT: Do not use this to add new items."
                        rows={4}
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        <strong>Note:</strong> Use this field for clarifications on existing items (color, position, etc.). Instructions to <strong>add new toppers</strong> will be ignored.
                    </p>
                </div>
             </Section>
        </div>
    );
};