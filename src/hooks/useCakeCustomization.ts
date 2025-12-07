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
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, COLORS, CAKE_TYPES, DEFAULT_ICING_DESIGN, FLAVOR_OPTIONS } from '../constants';
import { showSuccess } from '../lib/utils/toast';
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
        setIcingDesign(DEFAULT_ICING_DESIGN);
        setAdditionalInstructions('');
        setIsCustomizationDirty(false);
        setDirtyFields(new Set());
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

    const onSupportElementChange = useCallback((elements: SupportElementUI[]) => {
        setSupportElements(elements);
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

                for (const key of allColorKeys) {
                    // FIX: Explicitly cast key to avoid symbol conversion error in strict mode.
                    const k = key as keyof IcingColorDetails;
                    if (prevIcing.colors[k] !== newDesign.colors[k]) {
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

    const handleApplyAnalysis = useCallback((rawData: HybridAnalysisResult, options?: { skipToast?: boolean }) => {
        setAnalysisId(uuidv4());
        setAnalysisResult(rawData);

        if (!dirtyFields.has('cakeInfo')) {
            const getFlavorCount = (type: CakeType): number => {
                if (type.includes('2 Tier')) return 2;
                if (type.includes('3 Tier')) return 3;
                return 1;
            };
            const flavorCount = getFlavorCount(rawData.cakeType);
            const initialFlavors: CakeFlavor[] = Array(flavorCount).fill('Chocolate Cake');
            setCakeInfo({
                type: rawData.cakeType,
                thickness: rawData.cakeThickness,
                flavors: initialFlavors,
                size: DEFAULT_SIZE_MAP[rawData.cakeType]
            });
        }

        if (!dirtyFields.has('mainToppers')) {
            const newMainToppers = rawData.main_toppers.map((t): MainTopperUI => {
                let initialType = t.type;
                const canBePrintout = t.type && ['edible_3d', 'toy', 'figurine', 'edible_photo_top'].includes(t.type);
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
            const newSupportElements = rawData.support_elements.map((s): SupportElementUI => {
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
            const newCakeMessages = rawData.cake_messages.map((msg): CakeMessageUI => ({
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
            const analysisIcing = rawData.icing_design;
            if (!prev) return { ...analysisIcing, dripPrice: 100, gumpasteBaseBoardPrice: 100 };

            const newIcing = { ...prev, colors: { ...prev.colors } };

            if (!dirtyFields.has('icingDesign.base')) newIcing.base = analysisIcing.base;
            if (!dirtyFields.has('icingDesign.color_type')) newIcing.color_type = analysisIcing.color_type;
            if (!dirtyFields.has('icingDesign.drip')) newIcing.drip = analysisIcing.drip;

            if (!dirtyFields.has('icingDesign.gumpasteBaseBoard')) {
                // Logic for white baseboard is now handled at the start of the function
                newIcing.gumpasteBaseBoard = analysisIcing.gumpasteBaseBoard;
            }

            if (!dirtyFields.has('icingDesign.border_top')) newIcing.border_top = analysisIcing.border_top;
            if (!dirtyFields.has('icingDesign.border_base')) newIcing.border_base = analysisIcing.border_base;

            // Handle colors: If no specific color fields are dirty, we want to adopt the analysis colors EXACTLY
            // to avoid key-order mismatches in JSON.stringify comparisons later.
            const areAnyColorsDirty = Object.keys(prev.colors).some(k => dirtyFields.has(`icingDesign.colors.${k}`));

            if (!areAnyColorsDirty) {
                newIcing.colors = { ...analysisIcing.colors };
            } else {
                // Fallback to merging if user has modified some colors
                const allAnalysisColorKeys = Object.keys(analysisIcing.colors) as Array<keyof IcingColorDetails>;
                for (const colorKey of allAnalysisColorKeys) {
                    if (!dirtyFields.has(`icingDesign.colors.${String(colorKey)}`)) {
                        newIcing.colors[colorKey] = analysisIcing.colors[colorKey];
                    }
                }
            }

            return newIcing;
        });

        if (!dirtyFields.has('additionalInstructions')) {
            setAdditionalInstructions('');
        }

        setIsCustomizationDirty(false);
        setDirtyFields(new Set());

        // Only show toast if not skipped (Phase 1 only, not Phase 2 coordinate updates)
        if (!options?.skipToast) {
            const toppersFound = rawData.main_toppers.length;
            const elementsFound = rawData.support_elements.length;
            let analysisSummaryParts: string[] = [];
            if (toppersFound > 0) analysisSummaryParts.push(`${toppersFound} topper${toppersFound > 1 ? 's' : ''}`);
            if (elementsFound > 0) analysisSummaryParts.push(`${elementsFound} design element${elementsFound > 1 ? 's' : ''}`);
            const analysisSummary = analysisSummaryParts.length > 0 ? `We found ${analysisSummaryParts.join(' and ')}.` : "We've analyzed your cake's base design.";
            showSuccess(`Price and Design Elements updated! ${analysisSummary}`, { duration: 6000 });
        }

    }, [dirtyFields]);

    useEffect(() => {
        if (pendingAnalysisData) {
            // Check if this is a coordinate-only update by comparing with current analysisResult
            const isCoordinateUpdate = analysisResult &&
                analysisResult.main_toppers.length === pendingAnalysisData.main_toppers.length &&
                analysisResult.support_elements.length === pendingAnalysisData.support_elements.length &&
                analysisResult.cake_messages.length === pendingAnalysisData.cake_messages.length;

            handleApplyAnalysis(pendingAnalysisData, { skipToast: isCoordinateUpdate });
            setPendingAnalysisData(null); // Clear after applying to prevent re-runs
            // Ensure dirty state is cleared after analysis is applied
            // This handles any state updates that might have occurred during handleApplyAnalysis
            setIsCustomizationDirty(false);
            setDirtyFields(new Set());
        }
    }, [pendingAnalysisData, handleApplyAnalysis, analysisResult]);

    const handleTopperImageReplace = useCallback(async (topperId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService');
            const replacementData = await fileToBase64(file);
            updateMainTopper(topperId, { replacementImage: replacementData });
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, [updateMainTopper]);

    const handleSupportElementImageReplace = useCallback(async (elementId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService');
            const replacementData = await fileToBase64(file);
            updateSupportElement(elementId, { replacementImage: replacementData });
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, [updateSupportElement]);

    // Function to sync analysisResult with current state (used after successful design update)
    const syncAnalysisResultWithCurrentState = useCallback(() => {
        if (!analysisResult) return;

        // Update the analysisResult to reflect the current applied state
        setAnalysisResult(prev => {
            if (!prev) return prev;

            // Sync main toppers: update original_* fields to match current state
            const syncedMainToppers = mainToppers.map(t => ({
                ...t,
                original_type: t.type,
                original_color: t.color,
                original_colors: t.colors,
            }));

            // Sync support elements: update original_* fields to match current state
            const syncedSupportElements = supportElements.map(s => ({
                ...s,
                original_type: s.type,
                original_color: s.color,
                original_colors: s.colors,
            }));

            // Sync cake messages: extract only the base CakeMessage properties
            // This ensures we don't pollute the analysis result with UI-only properties
            const syncedCakeMessages = cakeMessages.map(m => ({
                type: m.type,
                text: m.text,
                position: m.position,
                color: m.color,
                x: m.x,
                y: m.y,
            }));

            // Sync icing design: extract only the base IcingDesign properties
            // This ensures we don't pollute the analysis result with UI-only properties (dripPrice, gumpasteBaseBoardPrice)
            const syncedIcingDesign = icingDesign ? {
                base: icingDesign.base,
                color_type: icingDesign.color_type,
                colors: icingDesign.colors,
                border_top: icingDesign.border_top,
                border_base: icingDesign.border_base,
                drip: icingDesign.drip,
                gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
            } : prev.icing_design;

            return {
                ...prev,
                main_toppers: syncedMainToppers,
                support_elements: syncedSupportElements,
                cake_messages: syncedCakeMessages,
                icing_design: syncedIcingDesign,
                cakeType: cakeInfo?.type || prev.cakeType,
                cakeThickness: cakeInfo?.thickness || prev.cakeThickness,
            };
        });

        // Update the UI state objects to also reset their original_* fields
        setMainToppers(prev => prev.map(t => ({
            ...t,
            original_type: t.type,
            original_color: t.color,
            original_colors: t.colors,
        })));

        setSupportElements(prev => prev.map(s => ({
            ...s,
            original_type: s.type,
            original_color: s.color,
            original_colors: s.colors,
        })));

        // Update cake messages to reset their originalMessage to current state
        setCakeMessages(prev => prev.map(m => ({
            ...m,
            originalMessage: {
                type: m.type,
                text: m.text,
                position: m.position,
                color: m.color,
                x: m.x,
                y: m.y,
            },
        })));

        setIsCustomizationDirty(false);
        setDirtyFields(new Set());
    }, [analysisResult, mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo]);


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
        onSupportElementChange, // Kept for complex changes if needed
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
        syncAnalysisResultWithCurrentState,
    };
};