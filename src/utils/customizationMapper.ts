import { v4 as uuidv4 } from 'uuid';
import {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    CakeInfoUI,
    IcingDesignUI,
    CakeType,
    CakeFlavor,
    IcingColorDetails,
} from '@/types';
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, DEFAULT_ICING_DESIGN } from '@/constants';
import { CustomizationState } from '@/contexts/CustomizationContext';

export function mapAnalysisToState(rawData: HybridAnalysisResult): CustomizationState {
    const state: CustomizationState = {};

    // 1. Cake Info
    const getFlavorCount = (type: CakeType): number => {
        if (!type) return 1;
        if (type.includes('2 Tier')) return 2;
        if (type.includes('3 Tier')) return 3;
        return 1;
    };

    const cakeType: CakeType = rawData.cakeType || '1 Tier';
    const cakeThickness = rawData.cakeThickness || DEFAULT_THICKNESS_MAP[cakeType] || '3 in';
    const flavorCount = getFlavorCount(cakeType);
    const initialFlavors: CakeFlavor[] = Array(flavorCount).fill('Chocolate Cake');

    state.cakeInfo = {
        type: cakeType,
        thickness: cakeThickness,
        flavors: initialFlavors,
        size: DEFAULT_SIZE_MAP[cakeType] || '6" Round'
    };

    // 2. Main Toppers
    state.mainToppers = (rawData.main_toppers || []).map((t): MainTopperUI => {
        let initialType = t.type;
        const canBePrintout = ['edible_3d', 'toy', 'figurine', 'plastic_ball', 'edible_photo_top'].includes(t.type);
        const isCharacterOrLogo = /character|figure|logo|brand/i.test(t.description);

        if (canBePrintout && isCharacterOrLogo) {
            initialType = 'printout';
        }

        // Force toys to be printouts as per business rule
        if (['toy', 'figurine', 'plastic_ball'].includes(t.type)) {
            initialType = 'printout';
        }

        return {
            ...t,
            x: t.x,
            y: t.y,
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

    // 3. Support Elements
    state.supportElements = (rawData.support_elements || []).map((s): SupportElementUI => {
        let initialType = s.type;
        if (s.type === 'edible_photo_side') {
            initialType = 'support_printout';
        }

        return {
            ...s,
            x: s.x,
            y: s.y,
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

    // 4. Cake Messages
    state.cakeMessages = (rawData.cake_messages || []).map((msg): CakeMessageUI => ({
        ...msg,
        x: msg.x,
        y: msg.y,
        id: uuidv4(),
        isEnabled: true,
        price: 0,
        originalMessage: { ...msg }
    }));

    // 5. Icing Design
    const analysisIcing = rawData.icing_design;
    if (analysisIcing) {
        state.icingDesign = {
            ...analysisIcing,
            dripPrice: 100,
            gumpasteBaseBoardPrice: 100,
            colors: { ...analysisIcing.colors } // Clone colors
        };
    } else {
        state.icingDesign = { ...DEFAULT_ICING_DESIGN, dripPrice: 100, gumpasteBaseBoardPrice: 100 };
    }

    // 6. Additional Instructions
    state.additionalInstructions = '';

    // 7. Analysis Result & ID
    state.analysisResult = rawData;
    // We don't set analysisId here typically, but we could if known. 
    // The consumer might generate one.

    return state;
}
