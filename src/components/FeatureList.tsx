import React, { useState, useRef, useEffect, useMemo } from 'react';
// Force rebuild for style update
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, CakeType, CakeThickness, CakeFlavor, BasePriceInfo } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { ChevronDownIcon } from './icons';
import { CAKE_TYPES, THICKNESS_OPTIONS_MAP, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, FLAVOR_OPTIONS, FLAVOR_THUMBNAILS, TIER_THUMBNAILS } from '../constants';
import { CakeBaseSkeleton } from './LoadingSkeletons';
import { CakeBaseOptions } from './CakeBaseOptions';
import { AnalysisItem } from '../app/customizing/page';


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
    addCakeMessage: (position: 'top' | 'side' | 'base_board') => void;
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
    cakeMessagesSectionRef?: React.RefObject<HTMLDivElement>;
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
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 text-left">
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-700">{title}</h3>
                    {analysisText && <span className="text-xs text-slate-500 animate-pulse">{analysisText}</span>}
                    {count !== undefined && count > 0 && (
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
                    )}
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
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
    onCakeInfoChange, onAdditionalInstructionsChange, updateCakeMessage, removeCakeMessage, addCakeMessage, isAnalyzing, shopifyFixedSize, shopifyBasePrice, cakeBaseSectionRef, cakeMessagesSectionRef,
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

    // Determine which message positions are missing
    const existingPositions = useMemo(() => {
        return new Set(cakeMessages.map(msg => msg.position));
    }, [cakeMessages]);

    const missingTopMessage = !existingPositions.has('top');
    const missingSideMessage = !existingPositions.has('side');
    const missingBaseBoardMessage = !existingPositions.has('base_board');

    if (analysisError) return <div className="text-center p-4 bg-red-50 rounded-lg text-red-700"><p className="font-semibold">Analysis Failed</p><p className="text-sm">{analysisError}</p></div>;
    if (!icingDesign || !cakeInfo) return null;

    const currentThicknessOptions = THICKNESS_OPTIONS_MAP[cakeInfo.type] || [];
    const tierCount = cakeInfo.flavors.length;
    const tierLabels = tierCount === 2 ? ['Top Tier Flavor', 'Bottom Tier Flavor'] : tierCount === 3 ? ['Top Tier Flavor', 'Middle Tier Flavor', 'Bottom Tier Flavor'] : ['Cake Flavor'];

    return (
        <div className="space-y-2.5">
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } .animate-fade-in-fast { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* Cake Options Section */}
            <Section title="Cake Options" defaultOpen={true}>
                <CakeBaseOptions
                    cakeInfo={cakeInfo}
                    basePriceOptions={basePriceOptions}
                    onCakeInfoChange={onCakeInfoChange}
                    isAnalyzing={isAnalyzing}
                />
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
