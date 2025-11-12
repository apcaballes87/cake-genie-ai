import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI,
    CakeType,
    CakeFlavor,
    IcingColorDetails,
} from '../types';
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, COLORS, CAKE_TYPES } from '../constants';
import { showSuccess } from '../lib/utils/toast';
import { ShopifyCustomizationRequest } from '../services/supabaseService';
import { calculateCustomizingAvailability, AvailabilityType } from '../lib/utils/availability';

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
    const [availability, setAvailability] = useState<AvailabilityType>('normal');

    // --- Effect to calculate availability ---
    useEffect(() => {
        if (cakeInfo && icingDesign) {
            const newAvailabilityType = calculateCustomizingAvailability(
                cakeInfo,
                icingDesign,
                mainToppers,
                supportElements
            );
            setAvailability(newAvailabilityType);
        }
    }, [cakeInfo, icingDesign, mainToppers, supportElements]);


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
    
    // --- NEW ROBUST STATE UPDATERS ---
    const markDirty = (field: DirtyField) => {
        setIsCustomizationDirty(true);
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const updateMainTopper = useCallback((id: string, updates: Partial<MainTopperUI>) => {
        setMainToppers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        markDirty('mainToppers');
    }, []);

    const removeMainTopper = useCallback((id: string) => {
        setMainToppers(prev => prev.filter(t => t.id !== id));
        markDirty('mainToppers');
    }, []);

    const onMainTopperChange = useCallback((toppers: MainTopperUI[]) => {
        setMainToppers(toppers);
        markDirty('mainToppers');
    }, []);
    
    const updateSupportElement = useCallback((id: string, updates: Partial<SupportElementUI>) => {
        setSupportElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
        markDirty('supportElements');
    }, []);

    const removeSupportElement = useCallback((id: string) => {
        setSupportElements(prev => prev.filter(e => e.id !== id));
        markDirty('supportElements');
    }, []);
    
    const updateCakeMessage = useCallback((id: string, updates: Partial<CakeMessageUI>) => {
        setCakeMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        markDirty('cakeMessages');
    }, []);

    const removeCakeMessage = useCallback((id: string) => {
        setCakeMessages(prev => prev.filter(m => m.id !== id));
        markDirty('cakeMessages');
    }, []);

    const onCakeMessageChange = useCallback((messages: CakeMessageUI[]) => {
        setCakeMessages(messages);
        markDirty('cakeMessages');
    }, []);
    
    // --- END NEW ROBUST STATE UPDATERS ---

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
                    // FIX: Explicitly cast key to avoid symbol conversion error in strict mode.
                    const k = key as keyof IcingColorDetails;
                    if(prevIcing.colors[k] !== newDesign.colors[k]){
                        newDirtyFields.add(`icingDesign.colors.${k}`);
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
        markDirty('additionalInstructions');
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
        setAnalysisId(uuidv4());
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
            const newMainToppers = analysisData.main_toppers.map((t): MainTopperUI => {
                let initialType = t.type;
                const canBePrintout = ['edible_3d', 'toy', 'figurine', 'edible_photo'].includes(t.type);
                const isCharacterOrLogo = /character|figure|logo|brand/i.test(t.description);

                // Default to 'printout' for characters, logos, etc., if it's a valid alternative
                if (canBePrintout && isCharacterOrLogo) {
                    initialType = 'printout';
                }
                
                return {
                    ...t,
                    x: t.x, // Explicitly carry over x
                    y: t.y, // Explicitly carry over y
                    id: uuidv4(),
                    isEnabled: true,
                    price: 0,
                    original_type: t.type,
                    type: initialType,
                    replacementImage: undefined,
                    original_color: t.color,
                    original_colors: t.colors,
                };
            });
            setMainToppers(newMainToppers);
        }
    
        if (!dirtyFields.has('supportElements')) {
            const newSupportElements = analysisData.support_elements.map((s): SupportElementUI => {
                let initialType = s.type;
                // Default edible photo wraps to the more common 'support_printout' option first.
                if (s.type === 'edible_photo_side') {
                    initialType = 'support_printout';
                }

                return {
                    ...s,
                    x: s.x, // Explicitly carry over x
                    y: s.y, // Explicitly carry over y
                    id: uuidv4(),
                    isEnabled: true,
                    price: 0,
                    original_type: s.type,
                    type: initialType,
                    replacementImage: undefined,
                    original_color: s.color,
                    original_colors: s.colors,
                };
            });
            setSupportElements(newSupportElements);
        }
    
        if (!dirtyFields.has('cakeMessages')) {
            const newCakeMessages = analysisData.cake_messages.map((msg): CakeMessageUI => ({
                 ...msg,
                 x: msg.x, // Explicitly carry over x
                 y: msg.y, // Explicitly carry over y
                 id: uuidv4(),
                 isEnabled: true,
                 price: 0,
                 originalMessage: { ...msg }
            }));
            setCakeMessages(newCakeMessages);
        }
    
        setIcingDesign(prev => {
            const analysisIcing = analysisData.icing_design;
            if (!prev) return { ...analysisIcing, dripPrice: 100, gumpasteBaseBoardPrice: 100 };
            
            const newIcing = { ...prev, colors: { ...prev.colors } };
    
            if (!dirtyFields.has('icingDesign.base')) newIcing.base = analysisIcing.base;
            if (!dirtyFields.has('icingDesign.color_type')) newIcing.color_type = analysisIcing.color_type;
            if (!dirtyFields.has('icingDesign.drip')) newIcing.drip = analysisIcing.drip;
            
            if (!dirtyFields.has('icingDesign.gumpasteBaseBoard')) {
                const isBaseBoardWhite = analysisIcing.colors.gumpasteBaseBoardColor?.toLowerCase() === '#ffffff';
                // The feature is enabled only if the AI detects it AND the color is not white.
                newIcing.gumpasteBaseBoard = analysisIcing.gumpasteBaseBoard && !isBaseBoardWhite;
            }

            if (!dirtyFields.has('icingDesign.border_top')) newIcing.border_top = analysisIcing.border_top;
            if (!dirtyFields.has('icingDesign.border_base')) newIcing.border_base = analysisIcing.border_base;
            
            const allAnalysisColorKeys = Object.keys(analysisIcing.colors) as Array<keyof typeof analysisIcing.colors>;
            for (const colorKey of allAnalysisColorKeys) {
                // FIX: Explicitly cast key to string to avoid symbol conversion error in strict mode.
                if (!dirtyFields.has(`icingDesign.colors.${String(colorKey)}`)) {
                    (newIcing.colors as any)[colorKey] = (analysisIcing.colors as any)[colorKey];
                }
            }
            
            return newIcing;
        });
        
        if (!dirtyFields.has('additionalInstructions')) {
            setAdditionalInstructions('');
        }
    
        setIsCustomizationDirty(false);
        setDirtyFields(new Set()); 
    
        // Removed auto-scroll toast notification after analysis
        // const toppersFound = analysisData.main_toppers.length;
        // const elementsFound = analysisData.support_elements.length;
        // let analysisSummaryParts: string[] = [];
        // if (toppersFound > 0) analysisSummaryParts.push(`${toppersFound} topper${toppersFound > 1 ? 's' : ''}`);
        // if (elementsFound > 0) analysisSummaryParts.push(`${elementsFound} design element${elementsFound > 1 ? 's' : ''}`);
        // const analysisSummary = analysisSummaryParts.length > 0 ? `We found ${analysisSummaryParts.join(' and ')}.` : "We've analyzed your cake's base design.";
        // showSuccess(`Price and Design Elements updated! ${analysisSummary}`, { duration: 6000 });
    
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
            updateMainTopper(topperId, { replacementImage: replacementData });
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, [updateMainTopper]);

    const handleSupportElementImageReplace = useCallback(async (elementId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService.lazy');
            const replacementData = await fileToBase64(file);
            updateSupportElement(elementId, { replacementImage: replacementData });
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, [updateSupportElement]);


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
        availability,

        // Setters
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        setIsCustomizationDirty,

        // Functions
        handleCakeInfoChange,
        onMainTopperChange, // Kept for complex changes if needed
        updateMainTopper,
        removeMainTopper,
        updateSupportElement,
        removeSupportElement,
        onCakeMessageChange, // Kept for complex changes if needed
        updateCakeMessage,
        removeCakeMessage,
        onIcingDesignChange,
        onAdditionalInstructionsChange,
        handleTopperImageReplace,
        handleSupportElementImageReplace,
        clearCustomization,
        initializeDefaultState,
        initializeFromShopify,
    };
};