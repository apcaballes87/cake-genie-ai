

import { useState, useCallback, useEffect } from 'react';
import {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI,
    CakeType,
    CakeFlavor,
} from '../types';
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, COLORS, CAKE_TYPES } from '../constants';
import { showSuccess } from '../lib/utils/toast';
import { ShopifyCustomizationRequest } from '../services/supabaseService';

// 'icingDesign' is now handled with granular dot-notation strings
type DirtyField = 'cakeInfo' | 'mainToppers' | 'supportElements' | 'cakeMessages' | 'additionalInstructions';

export const useCakeCustomization = () => {
    // --- State ---
    const [cakeInfo, setCakeInfo] = useState<CakeInfoUI | null>(null);
    const [mainToppers, setMainToppers] = useState<MainTopperUI[]>([]);
    const [supportElements, setSupportElements] = useState<SupportElementUI[]>([]);
    const [cakeMessages, setCakeMessages] = useState<CakeMessageUI[]>([]);
    const [icingDesign, setIcingDesign] = useState<IcingDesignUI | null>(null);
    const [additionalInstructions, setAdditionalInstructions] = useState<string>('');

    const [analysisResult, setAnalysisResult] = useState<HybridAnalysisResult | null>(null);
    const [analysisId, setAnalysisId] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [pendingAnalysisData, setPendingAnalysisData] = useState<HybridAnalysisResult | null>(null);
    
    const [isCustomizationDirty, setIsCustomizationDirty] = useState(false);
    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

    // --- Logic and Handlers ---

    const initializeDefaultState = useCallback(() => {
        const defaultCakeType: CakeType = '1 Tier';
        setCakeInfo({
            type: defaultCakeType,
            thickness: DEFAULT_THICKNESS_MAP[defaultCakeType],
            flavors: ['Chocolate Cake'],
            size: DEFAULT_SIZE_MAP[defaultCakeType]
        });
        setMainToppers([]);
        setSupportElements([]);
        setCakeMessages([]);
        setIcingDesign({
            base: 'soft_icing',
            color_type: 'single',
            colors: { side: '#FFFFFF' },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false,
            dripPrice: 100,
            gumpasteBaseBoardPrice: 100,
        });
        setAdditionalInstructions('');
        setIsCustomizationDirty(false);
        setDirtyFields(new Set());
    }, []);

    const initializeFromShopify = useCallback((requestData: ShopifyCustomizationRequest) => {
        let cakeType: CakeType = '1 Tier';
        let flavor: CakeFlavor = 'Chocolate Cake';

        requestData.shopify_product_tags.forEach(tag => {
            const [key, value] = tag.split(':').map(s => s.trim());
            if (key === 'tier') {
                const tierNum = parseInt(value, 10);
                if (tierNum === 2) cakeType = '2 Tier';
                if (tierNum === 3) cakeType = '3 Tier';
            }
            if (key === 'type') {
                if ((CAKE_TYPES as readonly string[]).includes(value)) {
                    cakeType = value as CakeType;
                }
            }
            if (key === 'flavor' && ['Chocolate Cake', 'Ube Cake', 'Vanilla Cake', 'Mocha Cake'].includes(value)) {
                flavor = value as CakeFlavor;
            }
        });
        
        const getFlavorCount = (type: CakeType): number => {
            if (type.includes('2 Tier')) return 2;
            if (type.includes('3 Tier')) return 3;
            return 1;
        };
        const flavorCount = getFlavorCount(cakeType);
        const initialFlavors: CakeFlavor[] = Array(flavorCount).fill(flavor);

        setCakeInfo({
            type: cakeType,
            thickness: DEFAULT_THICKNESS_MAP[cakeType],
            flavors: initialFlavors,
            size: requestData.shopify_variant_title
        });

        // For Shopify flow, we assume a simple base without detected elements
        setMainToppers([]);
        setSupportElements([]);
        setCakeMessages([]);
        setIcingDesign({
            base: cakeType.includes('Fondant') ? 'fondant' : 'soft_icing',
            color_type: 'single',
            colors: { side: '#FFFFFF' },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false,
            dripPrice: 100,
            gumpasteBaseBoardPrice: 100,
        });
        setAdditionalInstructions('');
        setIsCustomizationDirty(false);
        setDirtyFields(new Set());
        
        // Mock a minimal analysis result so pricing logic can function
        setAnalysisResult({
            cakeType: cakeType,
            cakeThickness: DEFAULT_THICKNESS_MAP[cakeType],
            main_toppers: [],
            support_elements: [],
            cake_messages: [],
            icing_design: {
                base: cakeType.includes('Fondant') ? 'fondant' : 'soft_icing',
                color_type: 'single',
                colors: { side: '#FFFFFF' },
                border_top: false, border_base: false, drip: false, gumpasteBaseBoard: false
            }
        });
        setAnalysisId(`shopify-${Date.now()}`);

    }, []);

    const handleCakeInfoChange = useCallback((
        updates: Partial<CakeInfoUI>,
        options?: { isSystemCorrection?: boolean }
    ) => {
        setCakeInfo(prev => {
            if (!prev) return null;
            
            const newState = { ...prev, ...updates };
            
            if (updates.type && updates.type !== prev.type) {
                const newType = updates.type;
                
                newState.thickness = DEFAULT_THICKNESS_MAP[newType];
                newState.size = DEFAULT_SIZE_MAP[newType];

                const getFlavorCount = (type: CakeType): number => {
                    if (type.includes('2 Tier')) return 2;
                    if (type.includes('3 Tier')) return 3;
                    return 1;
                };
                const newFlavorCount = getFlavorCount(newType);
                const newFlavors: CakeFlavor[] = Array(newFlavorCount).fill('Chocolate Cake');
                newState.flavors = newFlavors;
            }
            
            return newState;
        });
        
        // Side effects for switching to Bento type
        if (updates.type === 'Bento') {
            setIcingDesign(prevIcing => {
                if (!prevIcing) return null;
                // Only update if changes are needed to prevent re-renders
                if (prevIcing.gumpasteBaseBoard || prevIcing.border_base) {
                    return { ...prevIcing, gumpasteBaseBoard: false, border_base: false };
                }
                return prevIcing;
            });
            setCakeMessages(prevMessages => {
                // Only update if there are base_board messages to remove
                if (prevMessages.some(m => m.position === 'base_board')) {
                    return prevMessages.filter(m => m.position !== 'base_board');
                }
                return prevMessages;
            });
        }

        if (!options?.isSystemCorrection) {
          setIsCustomizationDirty(true);
          setDirtyFields(prev => new Set(prev).add('cakeInfo'));
        }
    }, [setIsCustomizationDirty]);

    const onMainTopperChange = useCallback((toppers: MainTopperUI[]) => {
        setMainToppers(toppers);
        setIsCustomizationDirty(true);
        setDirtyFields(prev => new Set(prev).add('mainToppers'));
    }, []);

    const onSupportElementChange = useCallback((elements: SupportElementUI[]) => {
        setSupportElements(elements);
        setIsCustomizationDirty(true);
        setDirtyFields(prev => new Set(prev).add('supportElements'));
    }, []);

    const onCakeMessageChange = useCallback((messages: CakeMessageUI[]) => {
        setCakeMessages(messages);
        setIsCustomizationDirty(true);
        setDirtyFields(prev => new Set(prev).add('cakeMessages'));
    }, []);

    const onIcingDesignChange = useCallback((newDesign: IcingDesignUI) => {
        setIcingDesign(prevIcing => {
            if (!prevIcing) return newDesign;
    
            setDirtyFields(prevDirty => {
                const newDirtyFields = new Set(prevDirty);
    
                // Compare all boolean and string fields
                if (newDesign.drip !== prevIcing.drip) newDirtyFields.add('icingDesign.drip');
                if (newDesign.gumpasteBaseBoard !== prevIcing.gumpasteBaseBoard) newDirtyFields.add('icingDesign.gumpasteBaseBoard');
                if (newDesign.border_top !== prevIcing.border_top) newDirtyFields.add('icingDesign.border_top');
                if (newDesign.border_base !== prevIcing.border_base) newDirtyFields.add('icingDesign.base');
                if (newDesign.color_type !== prevIcing.color_type) newDirtyFields.add('icingDesign.color_type');
                
                // Compare color fields
                const allColorKeys = new Set([
                    ...Object.keys(prevIcing.colors), 
                    ...Object.keys(newDesign.colors)
                ]) as Set<keyof typeof newDesign.colors>;
                
                for(const key of allColorKeys){
                    if(prevIcing.colors[key] !== newDesign.colors[key]){
                        newDirtyFields.add(`icingDesign.colors.${key}`);
                    }
                }
                return newDirtyFields;
            });
    
            return newDesign;
        });
    
        setIsCustomizationDirty(true);
    }, [setIsCustomizationDirty]);
    
    const onAdditionalInstructionsChange = useCallback((instructions: string) => {
        setAdditionalInstructions(instructions);
        setIsCustomizationDirty(true);
        setDirtyFields(prev => new Set(prev).add('additionalInstructions'));
    }, []);

    const clearCustomization = useCallback(() => {
        setAnalysisResult(null);
        setAnalysisId(null);
        setCakeInfo(null);
        setMainToppers([]);
        setSupportElements([]);
        setCakeMessages([]);
        setIcingDesign(null);
        setAdditionalInstructions('');
        setAnalysisError(null);
        setIsAnalyzing(false);
        setIsCustomizationDirty(false);
        setDirtyFields(new Set());
    }, []);

    const handleApplyAnalysis = useCallback((analysisData: HybridAnalysisResult) => {
        setAnalysisId(crypto.randomUUID());
        setAnalysisResult(analysisData);
    
        if (!dirtyFields.has('cakeInfo')) {
            const getFlavorCount = (type: CakeType): number => {
                if (type.includes('2 Tier')) return 2;
                if (type.includes('3 Tier')) return 3;
                return 1;
            };
            const flavorCount = getFlavorCount(analysisData.cakeType);
            const initialFlavors: CakeFlavor[] = Array(flavorCount).fill('Chocolate Cake');
            setCakeInfo({ 
                type: analysisData.cakeType, 
                thickness: analysisData.cakeThickness, 
                flavors: initialFlavors,
                size: DEFAULT_SIZE_MAP[analysisData.cakeType]
            });
        }
    
        if (!dirtyFields.has('mainToppers')) {
            const newMainToppers = analysisData.main_toppers.map((t): MainTopperUI => ({
                ...t, id: crypto.randomUUID(), isEnabled: true, price: 0, original_type: t.type, replacementImage: undefined,
                color: t.color, original_color: t.color,
            }));
            setMainToppers(newMainToppers);
        }
    
        if (!dirtyFields.has('supportElements')) {
            const newSupportElements = analysisData.support_elements.map((s): SupportElementUI => ({
                ...s, id: crypto.randomUUID(), isEnabled: true, price: 0, original_type: s.type, replacementImage: undefined,
                color: s.color, original_color: s.color,
            }));
            setSupportElements(newSupportElements);
        }
    
        if (!dirtyFields.has('cakeMessages')) {
            const newCakeMessages = analysisData.cake_messages.map((msg): CakeMessageUI => ({ ...msg, id: crypto.randomUUID(), isEnabled: true, price: 0, originalMessage: { ...msg } }));
            setCakeMessages(newCakeMessages);
        }
    
        setIcingDesign(prev => {
            const analysisIcing = analysisData.icing_design;
            if (!prev) return { ...analysisIcing, dripPrice: 100, gumpasteBaseBoardPrice: 100 };
            
            const newIcing = { ...prev, colors: { ...prev.colors } };
    
            if (!dirtyFields.has('icingDesign.base')) newIcing.base = analysisIcing.base;
            if (!dirtyFields.has('icingDesign.color_type')) newIcing.color_type = analysisIcing.color_type;
            if (!dirtyFields.has('icingDesign.drip')) newIcing.drip = analysisIcing.drip;
            if (!dirtyFields.has('icingDesign.gumpasteBaseBoard')) newIcing.gumpasteBaseBoard = analysisIcing.gumpasteBaseBoard;
            if (!dirtyFields.has('icingDesign.border_top')) newIcing.border_top = analysisIcing.border_top;
            if (!dirtyFields.has('icingDesign.border_base')) newIcing.border_base = analysisIcing.border_base;
            
            const allAnalysisColorKeys = Object.keys(analysisIcing.colors) as Array<keyof typeof analysisIcing.colors>;
            for (const colorKey of allAnalysisColorKeys) {
                if (!dirtyFields.has(`icingDesign.colors.${colorKey}`)) {
                    newIcing.colors[colorKey] = analysisIcing.colors[colorKey];
                }
            }
            
            return newIcing;
        });
        
        if (!dirtyFields.has('additionalInstructions')) {
            setAdditionalInstructions('');
        }
    
        setIsCustomizationDirty(false);
        setDirtyFields(new Set()); 
    
        const toppersFound = analysisData.main_toppers.length;
        const elementsFound = analysisData.support_elements.length;
        let analysisSummaryParts: string[] = [];
        if (toppersFound > 0) analysisSummaryParts.push(`${toppersFound} topper${toppersFound > 1 ? 's' : ''}`);
        if (elementsFound > 0) analysisSummaryParts.push(`${elementsFound} design element${elementsFound > 1 ? 's' : ''}`);
        const analysisSummary = analysisSummaryParts.length > 0 ? `We found ${analysisSummaryParts.join(' and ')}.` : "We've analyzed your cake's base design.";
        showSuccess(`Price and Design Elements updated! ${analysisSummary}`, { duration: 6000 });
    
    }, [dirtyFields]);

    useEffect(() => {
        if (pendingAnalysisData) {
            handleApplyAnalysis(pendingAnalysisData);
            setPendingAnalysisData(null); // Clear after applying to prevent re-runs
        }
    }, [pendingAnalysisData, handleApplyAnalysis]);
    
    const handleTopperImageReplace = useCallback(async (topperId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService.lazy');
            const replacementData = await fileToBase64(file);
            setMainToppers(prevToppers =>
                prevToppers.map(t =>
                    t.id === topperId ? { ...t, replacementImage: replacementData } : t
                )
            );
            setIsCustomizationDirty(true);
            setDirtyFields(prev => new Set(prev).add('mainToppers'));
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, []);

    const handleSupportElementImageReplace = useCallback(async (elementId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService.lazy');
            const replacementData = await fileToBase64(file);
            setSupportElements(prevElements =>
                prevElements.map(el =>
                    el.id === elementId ? { ...el, replacementImage: replacementData } : el
                )
            );
            setIsCustomizationDirty(true);
            setDirtyFields(prev => new Set(prev).add('supportElements'));
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, []);


    return {
        // State
        cakeInfo,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions,
        analysisResult,
        analysisId,
        isAnalyzing,
        analysisError,
        isCustomizationDirty,
        dirtyFields,

        // Setters
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        setIsCustomizationDirty,

        // Functions
        handleCakeInfoChange,
        onMainTopperChange,
        onSupportElementChange,
        onCakeMessageChange,
        onIcingDesignChange,
        onAdditionalInstructionsChange,
        handleTopperImageReplace,
        handleSupportElementImageReplace,
        clearCustomization,
        initializeDefaultState,
        initializeFromShopify,
    };
};