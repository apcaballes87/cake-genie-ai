import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, CakeType, CakeThickness, CakeFlavor, BasePriceInfo, AnalysisItem } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { ChevronDownIcon } from './icons';
import { CAKE_TYPES, THICKNESS_OPTIONS_MAP, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, FLAVOR_OPTIONS, FLAVOR_THUMBNAILS, TIER_THUMBNAILS } from '../constants';
import { CakeBaseSkeleton } from './LoadingSkeletons';


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
  updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
  removeMainTopper: (id: string) => void;
  updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
  removeSupportElement: (id: string) => void;
  updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
  removeCakeMessage: (id: string) => void;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  onAdditionalInstructionsChange: (instructions: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => void;
  onSupportElementImageReplace: (elementId: string, file: File) => void;
  isAnalyzing: boolean;
  itemPrices: Map<string, number>;
  user?: { email?: string } | null;
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
  cakeBaseSectionRef?: React.RefObject<HTMLDivElement>;
  // New props for interaction
  onItemClick: (item: AnalysisItem) => void;
  markerMap: Map<string, string>;
}

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)', '2 Tier': '2 Tier (Soft icing)', '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant', '2 Tier Fondant': '2 Tier Fondant', '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square', 'Rectangle': 'Rectangle', 'Bento': 'Bento',
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

const ListItem: React.FC<{ item: AnalysisItem; marker?: string; onClick: (item: AnalysisItem) => void }> = React.memo(({ item, marker, onClick }) => {
    const description = 'text' in item ? `"${item.text}"` : item.description;
    
    return (
        <button
            onClick={() => onClick(item)}
            className="w-full flex items-center gap-3 p-3 text-left bg-white rounded-md border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
            {marker && (
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-600 text-xs font-bold rounded-full">
                    {marker}
                </div>
            )}
            <div className="flex-grow text-sm font-medium text-slate-800">
                {description}
            </div>
        </button>
    );
});
ListItem.displayName = 'ListItem';


export const FeatureList = React.memo<FeatureListProps>(({
    analysisError, analysisId, cakeInfo, basePriceOptions, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
    onCakeInfoChange, onAdditionalInstructionsChange, isAnalyzing, shopifyFixedSize, shopifyBasePrice, cakeBaseSectionRef,
    onItemClick, markerMap
}) => {
    const cakeTypeScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeThicknessScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeSizeScrollContainerRef = useRef<HTMLDivElement>(null);
    const [showAdditionalInstructions, setShowAdditionalInstructions] = useState(!!additionalInstructions);
    const prevAnalysisIdRef = useRef(analysisId);

    const mainToppersCount = mainToppers.reduce((sum, topper) => sum + topper.quantity, 0);
    const supportElementsCount = supportElements.length;

    useEffect(() => {
        if (analysisId !== prevAnalysisIdRef.current) {
            setShowAdditionalInstructions(false);
            prevAnalysisIdRef.current = analysisId;
        }
    }, [analysisId]);

    useEffect(() => {
        if (!analysisId) return;
        const timer = setTimeout(() => {
            if (cakeInfo) {
                const typeContainer = cakeTypeScrollContainerRef.current;
                if (typeContainer) {
                    const selectedTypeElement = typeContainer.querySelector(`[data-caketype="${CSS.escape(cakeInfo.type)}"]`);
                    if (selectedTypeElement) selectedTypeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
                const thicknessContainer = cakeThicknessScrollContainerRef.current;
                if (thicknessContainer) {
                    const selectedThicknessElement = thicknessContainer.querySelector(`[data-cakethickness="${CSS.escape(cakeInfo.thickness)}"]`);
                    if (selectedThicknessElement) selectedThicknessElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
                const sizeContainer = cakeSizeScrollContainerRef.current;
                if (sizeContainer && basePriceOptions) {
                     const selectedSizeElement = sizeContainer.querySelector(`[data-cakesize="${CSS.escape(cakeInfo.size)}"]`);
                     if (selectedSizeElement) selectedSizeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [analysisId, cakeInfo, basePriceOptions]);
    
    if (analysisError) return <div className="text-center p-4 bg-red-50 rounded-lg text-red-700"><p className="font-semibold">Analysis Failed</p><p className="text-sm">{analysisError}</p></div>;
    if (!icingDesign || !cakeInfo) return null;

    const currentThicknessOptions = THICKNESS_OPTIONS_MAP[cakeInfo.type] || [];
    const tierCount = cakeInfo.flavors.length;
    const tierLabels = tierCount === 2 ? ['Top Tier Flavor', 'Bottom Tier Flavor'] : tierCount === 3 ? ['Top Tier Flavor', 'Middle Tier Flavor', 'Bottom Tier Flavor'] : ['Cake Flavor'];

    return (
        <div className="space-y-4">
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } .animate-fade-in-fast { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <h2 className="text-xl font-bold text-slate-800 text-center">Customize Your Cake</h2>
            
            <div ref={cakeBaseSectionRef}>
                <Section title="Cake Base" defaultOpen={!isAnalyzing} analysisText={isAnalyzing ? 'analyzing base...' : undefined}>
                    {isAnalyzing ? <CakeBaseSkeleton /> : (
                    <div className="space-y-4">
                        {shopifyFixedSize && shopifyBasePrice !== undefined && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Size & Base Price</label>
                                <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex items-center justify-between">
                                    <span className="text-sm font-semibold text-purple-800">{shopifyFixedSize}</span>
                                    <span className="text-sm font-bold text-purple-800">₱{shopifyBasePrice.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                        {!shopifyFixedSize && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Cake Type</label>
                                    <div className="relative"><div ref={cakeTypeScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">{CAKE_TYPES.map(type => (<button key={type} data-caketype={type} type="button" onClick={() => onCakeInfoChange({ type })} className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"><div className={`w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.type === type ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={CAKE_TYPE_THUMBNAILS[type]} alt={cakeTypeDisplayMap[type]} className="w-full h-full object-cover" /></div><span className="mt-2 text-xs font-medium text-slate-700 leading-tight">{cakeTypeDisplayMap[type]}</span></button>))}</div></div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Cake Height (All tiers)</label>
                                    <div className="relative"><div ref={cakeThicknessScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">{currentThicknessOptions.map(thickness => (<button key={thickness} data-cakethickness={thickness} type="button" onClick={() => onCakeInfoChange({ thickness })} className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"><div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.thickness === thickness ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={CAKE_THICKNESS_THUMBNAILS[thickness]} alt={`${thickness} height`} className="w-full h-full object-cover" /></div><span className="mt-2 text-xs font-semibold text-slate-800 leading-tight">{thickness}</span></button>))}</div></div>
                                </div>
                            </>
                        )}
                        {basePriceOptions && basePriceOptions.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Size (Diameter)</label>
                                {basePriceOptions.length === 1 ? (
                                    <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex items-center justify-between"><span className="text-sm font-semibold text-purple-800">{basePriceOptions[0].size}</span><span className="text-sm font-bold text-purple-800">₱{basePriceOptions[0].price.toLocaleString()}</span></div>
                                ) : (
                                    <div className="relative"><div ref={cakeSizeScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">{basePriceOptions.map(option => (<button key={option.size} data-cakesize={option.size} type="button" onClick={() => onCakeInfoChange({ size: option.size })} className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"><div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.size === option.size ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={CAKE_SIZE_THUMBNAILS[option.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]} alt={option.size} className="w-full h-full object-cover" /><div className="absolute inset-x-0 top-0 pt-4 text-black text-[10px] font-bold text-center leading-tight">{(() => { const sizePart = option.size.split(' ')[0]; const tiers = sizePart.match(/\d+"/g) || []; return (<div>{tiers.map((tier, index) => (<React.Fragment key={index}><span>&lt;- {tier} -&gt;</span><br /></React.Fragment>))}</div>);})()}</div></div><span className="mt-2 text-xs font-semibold text-slate-800 leading-tight">{option.size}</span><span className="text-xs text-slate-500">₱{option.price.toLocaleString()}</span></button>))}</div></div>
                                )}
                            </div>
                        )}
                        <div className="space-y-4 pt-4 border-t border-slate-200">{tierLabels.map((label, index) => { const tierThumbnailUrl = TIER_THUMBNAILS[tierCount]?.[index]; return (<div key={index}><div className="flex items-center gap-3">{tierThumbnailUrl && (<img src={tierThumbnailUrl} alt={`Tier ${index + 1}`} className="w-12 h-12 object-contain rounded-md" />)}<span className="text-sm font-medium text-slate-800">{label}</span></div><div className="mt-3"><div className="relative"><div className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide">{FLAVOR_OPTIONS.map(flavor => { const isBento = cakeInfo.type === 'Bento'; const isFlavorDisabled = isBento && (flavor === 'Ube Cake' || flavor === 'Mocha Cake'); return (<button key={flavor} type="button" disabled={isFlavorDisabled} onClick={() => { if (isFlavorDisabled) return; const newFlavors = [...cakeInfo.flavors]; newFlavors[index] = flavor; onCakeInfoChange({ flavors: newFlavors }); }} className={`group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-opacity ${isFlavorDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}><div className={`w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.flavors[index] === flavor ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={FLAVOR_THUMBNAILS[flavor]} alt={flavor} className={`w-full h-full object-cover transition-all ${isFlavorDisabled ? 'filter grayscale' : ''}`} /></div><span className="mt-2 text-xs font-medium text-slate-700 leading-tight">{flavor}</span></button>);})}</div></div></div></div>);})}</div>
                    </div>
                    )}
                </Section>
            </div>

            <Section title="Main Toppers" count={isAnalyzing && mainToppers.length === 0 ? undefined : mainToppersCount} defaultOpen={!isAnalyzing} analysisText={isAnalyzing && mainToppers.length === 0 ? 'analyzing toppers...' : undefined}>
                {mainToppers.length > 0 ? (
                    <div className="space-y-2">
                        {mainToppers.map((topper) => (
                            <ListItem
                                key={topper.id}
                                item={{ ...topper, itemCategory: 'topper' }}
                                marker={markerMap.get(topper.id)}
                                onClick={onItemClick}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No main toppers detected.</p>
                )}
            </Section>
            
            <Section title="Support Elements" count={isAnalyzing && supportElements.length === 0 ? undefined : supportElementsCount} defaultOpen={!isAnalyzing} analysisText={isAnalyzing && supportElements.length === 0 ? 'analyzing elements...' : undefined}>
                {supportElements.length > 0 ? (
                    <div className="space-y-2">
                        {supportElements.map((element) => (
                            <ListItem
                                key={element.id}
                                item={{ ...element, itemCategory: 'element' }}
                                marker={markerMap.get(element.id)}
                                onClick={onItemClick}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No support elements detected.</p>
                )}
            </Section>
            
            <Section title="Cake Messages" defaultOpen={!isAnalyzing} analysisText={isAnalyzing && cakeMessages.length === 0 ? 'analyzing messages...' : undefined}>
                {cakeMessages.length > 0 ? (
                     <div className="space-y-2">
                        {cakeMessages.map((message) => (
                            <ListItem
                                key={message.id}
                                item={{ ...message, itemCategory: 'message' }}
                                marker={markerMap.get(message.id)}
                                onClick={onItemClick}
                            />
                        ))}
                    </div>
                ) : (
                   <p className="text-sm text-slate-500 text-center py-4">No messages detected.</p>
                )}
            </Section>

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
                            onClick={() => { onAdditionalInstructionsChange(''); setShowAdditionalInstructions(false); }}
                            className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                            aria-label="Remove instructions"
                        >
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.144-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.057-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
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