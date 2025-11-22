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
    MainTopper,
    SupportElement,
    CakeMessage,
} from '../types';
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, COLORS, CAKE_TYPES } from '../constants';
import { showSuccess, showError } from '../lib/utils/toast';
import { ShopifyCustomizationRequest, uploadCustomizationImage } from '../services/supabaseService';
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
    const [dominantColors, setDominantColors] = useState<string[]>([]);
    
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
        setDominantColors([]);
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
        setDominantColors([]);
        
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

    const onMainTopperChange = useCallback((toppers: MainTopperUI[]) => {
        setMainToppers(toppers);
        markDirty('mainToppers');
    }, []);

    const updateMainTopper = useCallback((id: string, updates: Partial<MainTopperUI>) => {
        setMainToppers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        markDirty('mainToppers');
    }, []);

    const removeMainTopper = useCallback((id: string) => {
        setMainToppers(prev => prev.filter(t => t.id !== id));
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
        setDominantColors([]);
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

        setDominantColors(analysisData.dominant_colors || []);
    
        if (!dirtyFields.has('mainToppers')) {
            const groupedToppers = new Map<string, MainTopper[]>();
            analysisData.main_toppers.forEach(t => {
                const group = groupedToppers.get(t.group_id) || [];
                group.push(t);
                groupedToppers.set(t.group_id, group);
            });

            const newMainToppers: MainTopperUI[] = [];
            groupedToppers.forEach((group, groupId) => {
                const template = group[0];
                
                newMainToppers.push({
                    ...template,
                    id: groupId,
                    quantity: group.length,
                    isEnabled: true,
                    price: 0,
                    original_type: template.type,
                    type: template.type, // Use the analyzed type directly
                    replacementImage: undefined,
                    original_color: template.color,
                    original_colors: template.colors,
                });
            });
            setMainToppers(newMainToppers);
        }
    
        if (!dirtyFields.has('supportElements')) {
            const groupedElements = new Map<string, SupportElement[]>();
            analysisData.support_elements.forEach(s => {
                const group = groupedElements.get(s.group_id) || [];
                group.push(s);
                groupedElements.set(s.group_id, group);
            });

            const newSupportElements: SupportElementUI[] = [];
            groupedElements.forEach((group, groupId) => {
                const template = group[0];
                
                newSupportElements.push({
                    ...template,
                    id: groupId,
                    quantity: group.length,
                    isEnabled: true,
                    price: 0,
                    original_type: template.type,
                    type: template.type, // Use the analyzed type directly
                    replacementImage: undefined,
                    original_color: template.color,
                    original_colors: template.colors,
                });
            });
            setSupportElements(newSupportElements);
        }
    
        if (!dirtyFields.has('cakeMessages')) {
            const newCakeMessages = analysisData.cake_messages.map((msg): CakeMessageUI => ({
                 ...msg,
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
            
            // Directly use the analyzed value for gumpasteBaseBoard
            if (!dirtyFields.has('icingDesign.gumpasteBaseBoard')) {
                newIcing.gumpasteBaseBoard = analysisIcing.gumpasteBaseBoard;
            }

            if (!dirtyFields.has('icingDesign.border_top')) newIcing.border_top = analysisIcing.border_top;
            if (!dirtyFields.has('icingDesign.border_base')) newIcing.border_base = analysisIcing.border_base;
            
            const allAnalysisColorKeys = Object.keys(analysisIcing.colors) as Array<keyof typeof analysisIcing.colors>;
            for (const colorKey of allAnalysisColorKeys) {
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
    
    const handleTopperImageReplace = useCallback(async (topperId: string, file: File, userId: string) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService.lazy');
            
            // Optimistic UI update with base64 for immediate preview
            const replacementData = await fileToBase64(file);
            updateMainTopper(topperId, { replacementImage: replacementData, replacementImageUrl: undefined });

            // Upload and get URL
            const imageUrl = await uploadCustomizationImage(file, userId);
            
            // Final state update with URL
            updateMainTopper(topperId, { replacementImage: replacementData, replacementImageUrl: imageUrl });
            showSuccess("Custom image uploaded!");
        } catch (err) {
            // Rollback optimistic update by finding the original state
            const originalTopper = mainToppers.find(t => t.id === topperId);
            updateMainTopper(topperId, { 
                replacementImage: originalTopper?.replacementImage || undefined, 
                replacementImageUrl: originalTopper?.replacementImageUrl || undefined 
            });
            setAnalysisError("Could not upload the replacement image. Please try again.");
            showError(err instanceof Error ? err.message : "Image upload failed.");
        }
    }, [updateMainTopper, setAnalysisError, mainToppers]);

    const handleSupportElementImageReplace = useCallback(async (elementId: string, file: File, userId: string) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService.lazy');
            
            // Optimistic UI update
            const replacementData = await fileToBase64(file);
            updateSupportElement(elementId, { replacementImage: replacementData, replacementImageUrl: undefined });
            
            // Upload and get URL
            const imageUrl = await uploadCustomizationImage(file, userId);
            
            // Final update
            updateSupportElement(elementId, { replacementImage: replacementData, replacementImageUrl: imageUrl });
            showSuccess("Custom image uploaded!");

        } catch (err) {
            // Rollback
            const originalElement = supportElements.find(e => e.id === elementId);
            updateSupportElement(elementId, { 
                replacementImage: originalElement?.replacementImage || undefined, 
                replacementImageUrl: originalElement?.replacementImageUrl || undefined
            });
            setAnalysisError("Could not upload the replacement image. Please try again.");
            showError(err instanceof Error ? err.message : "Image upload failed.");
        }
    }, [updateSupportElement, setAnalysisError, supportElements]);

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
        dominantColors,

        // Setters
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        setIsCustomizationDirty,
        setDominantColors,

        // Functions
        handleCakeInfoChange,
        onMainTopperChange,
        updateMainTopper,
        removeMainTopper,
        updateSupportElement,
        removeSupportElement,
        onCakeMessageChange,
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