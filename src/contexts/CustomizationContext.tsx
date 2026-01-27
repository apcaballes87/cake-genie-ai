'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
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
} from '@/types'
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, DEFAULT_ICING_DESIGN } from '@/constants'
import { showSuccess } from '@/lib/utils/toast'
import { calculateCustomizingAvailability, AvailabilityType } from '@/lib/utils/availability'
import { mapAnalysisToState } from '@/utils/customizationMapper'

// 'icingDesign' is now handled with granular dot-notation strings
type DirtyField = 'cakeInfo' | 'mainToppers' | 'supportElements' | 'cakeMessages' | 'additionalInstructions';

interface CustomizationContextType {
    cakeInfo: CakeInfoUI | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    additionalInstructions: string;
    analysisResult: HybridAnalysisResult | null;
    analysisId: string | null;
    isAnalyzing: boolean;
    analysisError: string | null;
    isCustomizationDirty: boolean;
    dirtyFields: Set<string>;
    availability: AvailabilityType;
    setIsAnalyzing: (isAnalyzing: boolean) => void;
    setAnalysisError: (error: string | null) => void;
    setPendingAnalysisData: (data: HybridAnalysisResult | null) => void;
    setIsCustomizationDirty: (isDirty: boolean) => void;
    handleCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    onMainTopperChange: (toppers: MainTopperUI[]) => void;
    updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
    removeMainTopper: (id: string) => void;
    onSupportElementChange: (elements: SupportElementUI[]) => void;
    updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
    removeSupportElement: (id: string) => void;
    onCakeMessageChange: (messages: CakeMessageUI[]) => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    onIcingDesignChange: (newDesign: IcingDesignUI) => void;
    onAdditionalInstructionsChange: (instructions: string) => void;
    handleTopperImageReplace: (topperId: string, file: File) => Promise<void>;
    handleSupportElementImageReplace: (elementId: string, file: File) => Promise<void>;
    clearCustomization: () => void;
    initializeDefaultState: () => void;
    syncAnalysisResultWithCurrentState: () => void;
}

const CustomizationContext = createContext<CustomizationContextType | null>(null)

// Initial state interface for SSR hydration
export interface CustomizationState {
    cakeInfo?: CakeInfoUI | null;
    mainToppers?: MainTopperUI[];
    supportElements?: SupportElementUI[];
    cakeMessages?: CakeMessageUI[];
    icingDesign?: IcingDesignUI | null;
    additionalInstructions?: string;
    analysisResult?: HybridAnalysisResult | null;
    analysisId?: string | null;
}

export function CustomizationProvider({ children, initialData }: { children: React.ReactNode; initialData?: CustomizationState }) {
    // --- State ---
    // Initialize state with initialData if provided, otherwise null/empty
    const [cakeInfo, setCakeInfo] = useState<CakeInfoUI | null>(initialData?.cakeInfo || null);
    const [mainToppers, setMainToppers] = useState<MainTopperUI[]>(initialData?.mainToppers || []);
    const [supportElements, setSupportElements] = useState<SupportElementUI[]>(initialData?.supportElements || []);
    const [cakeMessages, setCakeMessages] = useState<CakeMessageUI[]>(initialData?.cakeMessages || []);
    const [icingDesign, setIcingDesign] = useState<IcingDesignUI | null>(initialData?.icingDesign || null);
    const [additionalInstructions, setAdditionalInstructions] = useState<string>(initialData?.additionalInstructions || '');

    const [analysisResult, setAnalysisResult] = useState<HybridAnalysisResult | null>(initialData?.analysisResult || null);
    const [analysisId, setAnalysisId] = useState<string | null>(initialData?.analysisId || null);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [pendingAnalysisData, setPendingAnalysisData] = useState<HybridAnalysisResult | null>(null);

    const [isCustomizationDirty, setIsCustomizationDirty] = useState(false);
    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
    const [availability, setAvailability] = useState<AvailabilityType>('normal');

    // --- Persistence Logic ---
    useEffect(() => {
        // Load state from localStorage on mount
        // Priority: initialData (SSR) > localStorage > defaults
        // If initialData is provided, we skip loading from localStorage to respect server source of truth
        if (initialData) return;

        const savedAnalysis = localStorage.getItem('cakegenie_analysis');
        const savedCustomization = localStorage.getItem('cakegenie_customization');

        if (savedAnalysis) {
            try {
                const parsed = JSON.parse(savedAnalysis);
                setAnalysisResult(parsed.result);
                setAnalysisId(parsed.id);
            } catch (e) {
                console.error('Failed to parse saved analysis:', e);
            }
        }

        if (savedCustomization) {
            try {
                const parsed = JSON.parse(savedCustomization);
                if (parsed.cakeInfo) setCakeInfo(parsed.cakeInfo);
                if (parsed.mainToppers) setMainToppers(parsed.mainToppers);
                if (parsed.supportElements) setSupportElements(parsed.supportElements);
                if (parsed.cakeMessages) setCakeMessages(parsed.cakeMessages);
                if (parsed.icingDesign) setIcingDesign(parsed.icingDesign);
                if (parsed.additionalInstructions) setAdditionalInstructions(parsed.additionalInstructions);
            } catch (e) {
                console.error('Failed to parse saved customization:', e);
            }
        }
    }, [initialData]);

    useEffect(() => {
        // Save analysis result whenever it changes
        if (analysisResult && analysisId) {
            // Preserve the existing imageRef if present (it gets set separately by the page component)
            const existingData = localStorage.getItem('cakegenie_analysis');
            let imageRef: string | null = null;
            if (existingData) {
                try {
                    const parsed = JSON.parse(existingData);
                    imageRef = parsed.imageRef || null;
                } catch {
                    // Ignore parse errors
                }
            }
            localStorage.setItem('cakegenie_analysis', JSON.stringify({
                result: analysisResult,
                id: analysisId,
                imageRef,
                timestamp: Date.now()
            }));
        } else {
            localStorage.removeItem('cakegenie_analysis');
        }
    }, [analysisResult, analysisId]);

    useEffect(() => {
        // Save customization state whenever it changes
        if (cakeInfo || mainToppers.length > 0 || supportElements.length > 0 || cakeMessages.length > 0 || icingDesign) {
            const customizationState = {
                cakeInfo,
                mainToppers,
                supportElements,
                cakeMessages,
                icingDesign,
                additionalInstructions
            };
            localStorage.setItem('cakegenie_customization', JSON.stringify(customizationState));
        } else {
            localStorage.removeItem('cakegenie_customization');
        }
    }, [cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions]);

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
        // Clear the stored image ref when clearing customization
        localStorage.removeItem('cakegenie_analysis');
    }, []);

    const handleApplyAnalysis = useCallback((rawData: HybridAnalysisResult, options?: { skipToast?: boolean }) => {
        setAnalysisId(uuidv4());
        setAnalysisResult(rawData);

        // Use the shared mapper to generate the target state from the analysis result
        // We import mapAnalysisToState dynamically to avoid circular dependencies if any, 
        // or just rely on the static import if added at top of file.
        // Ideally we added: import { mapAnalysisToState } from '@/utils/customizationMapper';

        // Since we can't easily add top-level imports with replace_file_content in a small chunk without potentially breaking things if we miss context,
        // we will assume the import is added or we will use require? No, let's just implement the logic using the imported function.
        // IMPORTANT: I need to ensure the import is present. I will add it separately or assume previous step was valid.
        // Actually, I should probably do a multi_replace to add the import too.

        const newState = mapAnalysisToState(rawData);

        if (!dirtyFields.has('cakeInfo') && newState.cakeInfo) {
            setCakeInfo(newState.cakeInfo);
        }

        if (!dirtyFields.has('mainToppers') && newState.mainToppers) {
            setMainToppers(newState.mainToppers);
        }

        if (!dirtyFields.has('supportElements') && newState.supportElements) {
            setSupportElements(newState.supportElements);
        }

        if (!dirtyFields.has('cakeMessages') && newState.cakeMessages) {
            setCakeMessages(newState.cakeMessages);
        }

        setIcingDesign(prev => {
            const newDesign = newState.icingDesign;
            if (!newDesign) return prev; // Should not happen given mapper logic
            if (!prev) return newDesign;

            // Merge logic for partial updates (preserving user edits)
            const mergedIcing = { ...prev, colors: { ...prev.colors } };

            if (!dirtyFields.has('icingDesign.base')) mergedIcing.base = newDesign.base;
            if (!dirtyFields.has('icingDesign.color_type')) mergedIcing.color_type = newDesign.color_type;
            if (!dirtyFields.has('icingDesign.drip')) mergedIcing.drip = newDesign.drip;
            if (!dirtyFields.has('icingDesign.gumpasteBaseBoard')) mergedIcing.gumpasteBaseBoard = newDesign.gumpasteBaseBoard;
            if (!dirtyFields.has('icingDesign.border_top')) mergedIcing.border_top = newDesign.border_top;
            if (!dirtyFields.has('icingDesign.border_base')) mergedIcing.border_base = newDesign.border_base;

            // Handle colors
            const areAnyColorsDirty = Object.keys(prev.colors).some(k => dirtyFields.has(`icingDesign.colors.${k}`));
            if (!areAnyColorsDirty) {
                mergedIcing.colors = { ...newDesign.colors };
            } else {
                const allAnalysisColorKeys = Object.keys(newDesign.colors) as Array<keyof IcingColorDetails>;
                for (const colorKey of allAnalysisColorKeys) {
                    if (!dirtyFields.has(`icingDesign.colors.${String(colorKey)}`)) {
                        mergedIcing.colors[colorKey] = newDesign.colors[colorKey];
                    }
                }
            }
            return mergedIcing;
        });

        if (!dirtyFields.has('additionalInstructions')) {
            setAdditionalInstructions('');
        }

        setIsCustomizationDirty(false);
        setDirtyFields(new Set());

        if (!options?.skipToast) {
            // Toast notification removed
        }

    }, [dirtyFields]);

    useEffect(() => {
        if (pendingAnalysisData) {
            // Check if this is a coordinate-only update by comparing with current analysisResult
            const isCoordinateUpdate = analysisResult &&
                analysisResult.main_toppers.length === pendingAnalysisData.main_toppers.length &&
                analysisResult.support_elements.length === pendingAnalysisData.support_elements.length &&
                analysisResult.cake_messages.length === pendingAnalysisData.cake_messages.length;

            handleApplyAnalysis(pendingAnalysisData, { skipToast: !!isCoordinateUpdate });
            setPendingAnalysisData(null); // Clear after applying to prevent re-runs
            // Ensure dirty state is cleared after analysis is applied
            // This handles any state updates that might have occurred during handleApplyAnalysis
            setIsCustomizationDirty(false);
            setDirtyFields(new Set());
        }
    }, [pendingAnalysisData, handleApplyAnalysis, analysisResult]);

    const handleTopperImageReplace = useCallback(async (topperId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('@/services/geminiService');
            const replacementData = await fileToBase64(file);
            updateMainTopper(topperId, { replacementImage: replacementData });
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, [updateMainTopper]);

    const handleSupportElementImageReplace = useCallback(async (elementId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('@/services/geminiService');
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

    const value = {
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
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        setIsCustomizationDirty,
        handleCakeInfoChange,
        onMainTopperChange,
        updateMainTopper,
        removeMainTopper,
        onSupportElementChange,
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
        syncAnalysisResultWithCurrentState,
    };

    return (
        <CustomizationContext.Provider value={value}>
            {children}
        </CustomizationContext.Provider>
    )
}

export function useCustomizationContext() {
    const context = useContext(CustomizationContext)
    if (!context) {
        throw new Error('useCustomizationContext must be used within CustomizationProvider')
    }
    return context
}

// Backward compatibility
export const useCakeCustomization = useCustomizationContext
