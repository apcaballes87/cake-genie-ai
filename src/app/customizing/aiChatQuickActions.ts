import type {
    MainTopperType,
    MainTopperUI,
    SupportElementType,
    SupportElementUI,
} from '@/types';

export type AiChatQuickActionMode = 'edible-photo' | 'toy-toppers' | 'edible-toppers' | null;
export type AiChatTopperMaterialAction = 'toy' | 'edible' | 'printout';

const MAIN_TOY_TOPPER_TYPES = new Set<MainTopperType>(['toy', 'figurine', 'plastic_ball']);
const MAIN_EDIBLE_TOPPER_TYPES = new Set<MainTopperType>([
    'edible_3d_complex',
    'edible_3d_ordinary',
    'edible_crown',
    'edible_2d_complex',
    'edible_logo_2d',
    'edible_2d_shapes',
]);

const PRINTOUT_EXCLUDED_TYPES = new Set<MainTopperType | SupportElementType>(['edible_flowers']);
const SUPPORT_EDIBLE_TOPPER_TYPES = new Set<SupportElementType>([
    'edible_3d_support',
    'edible_2d_support',
]);

type QuickActionItem = MainTopperUI | SupportElementUI;
type MaterialQuickActionMode = Exclude<AiChatQuickActionMode, 'edible-photo' | null>;

const isPrintoutExcluded = (item: QuickActionItem): boolean => {
    const anyItem = item as unknown as Record<string, unknown>;
    const sourceType = String(anyItem.original_type ?? anyItem.type);
    return PRINTOUT_EXCLUDED_TYPES.has(sourceType as MainTopperType | SupportElementType);
};

const getDesignTypes = (item: QuickActionItem): string[] => {
    const types: Array<string | undefined> = [
        item.type,
        item.original_type,
        item.printout_source_type,
    ];

    return types.filter((type, index): type is string => Boolean(type) && types.indexOf(type) === index);
};

const getSourceDesignTypes = (item: QuickActionItem): string[] => {
    const sourceTypes: Array<string | undefined> = [
        item.original_type,
        item.printout_source_type,
    ];
    const uniqueSourceTypes = sourceTypes.filter((type, index): type is string => (
        Boolean(type) && sourceTypes.indexOf(type) === index
    ));

    return uniqueSourceTypes.length > 0 ? uniqueSourceTypes : [item.type];
};

const getMaterialActionForType = (type: string): AiChatTopperMaterialAction | null => {
    if (MAIN_TOY_TOPPER_TYPES.has(type as MainTopperType)) return 'toy';
    if (MAIN_EDIBLE_TOPPER_TYPES.has(type as MainTopperType) || SUPPORT_EDIBLE_TOPPER_TYPES.has(type as SupportElementType)) return 'edible';
    if (type === 'printout' || type === 'support_printout') return 'printout';
    return null;
};

const getFirstMatchingType = <T extends string>(item: QuickActionItem, types: Set<T>): T | null => (
    getSourceDesignTypes(item).find((type): type is T => types.has(type as T)) ?? null
);

export const getTopperMaterialTargets = (
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    mode: MaterialQuickActionMode,
): { mainToppers: MainTopperUI[]; supportElements: SupportElementUI[] } => {
    const mainTypes = mode === 'toy-toppers' ? MAIN_TOY_TOPPER_TYPES : MAIN_EDIBLE_TOPPER_TYPES;

    return {
        mainToppers: mainToppers.filter((topper) => (
            getSourceDesignTypes(topper).some((type) => mainTypes.has(type as MainTopperType))
        )),
        // Plastic balls and similar support rows are decorations, not toy toppers.
        // Edible support rows remain part of the edible-topper group because their
        // individual cards expose the same edible/printout material choice.
        supportElements: mode === 'edible-toppers'
            ? supportElements.filter((element) => (
                getSourceDesignTypes(element).some((type) => SUPPORT_EDIBLE_TOPPER_TYPES.has(type as SupportElementType))
            ))
            : [],
    };
};

const updateMainTopperForAction = (
    topper: MainTopperUI,
    mode: Exclude<AiChatQuickActionMode, 'edible-photo' | null>,
    action: AiChatTopperMaterialAction,
): MainTopperUI => {
    if (action === 'toy') {
        const toyType = getFirstMatchingType(topper, MAIN_TOY_TOPPER_TYPES);
        return toyType ? { ...topper, type: toyType, isEnabled: true } : topper;
    }

    if (action === 'edible') {
        const type = mode === 'toy-toppers'
            ? 'edible_3d_complex'
            : getFirstMatchingType(topper, MAIN_EDIBLE_TOPPER_TYPES);
        return type ? { ...topper, type, isEnabled: true } : topper;
    }

    if (action === 'printout' && isPrintoutExcluded(topper)) {
        return topper;
    }

    const sourceType = topper.printout_source_type
        ?? (topper.type !== 'printout' ? topper.type : topper.original_type !== 'printout' ? topper.original_type : undefined);
    return {
        ...topper,
        type: 'printout',
        isEnabled: true,
        ...(sourceType ? { printout_source_type: sourceType } : {}),
    };
};

const updateSupportElementForAction = (
    element: SupportElementUI,
    action: AiChatTopperMaterialAction,
): SupportElementUI => {
    if (action === 'edible') {
        const type = getFirstMatchingType(element, SUPPORT_EDIBLE_TOPPER_TYPES);
        return type ? { ...element, type, isEnabled: true } : element;
    }

    if (action === 'toy') return element;

    if (action === 'printout' && isPrintoutExcluded(element)) {
        return element;
    }

    const sourceType = element.printout_source_type
        ?? (element.type !== 'support_printout' ? element.type : element.original_type !== 'support_printout' ? element.original_type : undefined);
    return {
        ...element,
        type: 'support_printout',
        isEnabled: true,
        ...(sourceType ? { printout_source_type: sourceType } : {}),
    };
};

const hasDirectMaterialChange = (current: QuickActionItem, next: QuickActionItem) => (
    current.type !== next.type
    || current.isEnabled !== next.isEnabled
    || current.printout_source_type !== next.printout_source_type
);

/**
 * Edible-photo replacement is the most specific action. Source provenance
 * keeps material controls available after a topper is converted in the editor.
 */
export const getAiChatQuickActionMode = (
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[] = [],
): AiChatQuickActionMode => {
    if (mainToppers.some((topper) => (
        topper.isEnabled && getDesignTypes(topper).includes('edible_photo_top')
    ))) {
        return 'edible-photo';
    }

    if (getTopperMaterialTargets(mainToppers, supportElements, 'toy-toppers').mainToppers.length > 0) {
        return 'toy-toppers';
    }

    const edibleTargets = getTopperMaterialTargets(mainToppers, supportElements, 'edible-toppers');
    if (edibleTargets.mainToppers.length > 0 || edibleTargets.supportElements.length > 0) {
        return 'edible-toppers';
    }

    return null;
};

/** Return the one visible material action that matches the current state. */
export const getAiChatQuickActionSelectedAction = (
    mainToppers: MainTopperUI[],
    mode: AiChatQuickActionMode,
    supportElements: SupportElementUI[] = [],
): AiChatTopperMaterialAction | null => {
    if (!mode || mode === 'edible-photo') return null;

    const targets = getTopperMaterialTargets(mainToppers, supportElements, mode);
    const targetItems: QuickActionItem[] = [...targets.mainToppers, ...targets.supportElements];
    if (targetItems.length === 0 || targetItems.some((item) => !item.isEnabled)) return null;

    const currentActions = targetItems
        .map((item) => getMaterialActionForType(item.type))
        .filter((action): action is AiChatTopperMaterialAction => action !== null);
    const firstAction = currentActions[0];
    const visibleActions: AiChatTopperMaterialAction[] = mode === 'toy-toppers'
        ? ['toy', 'edible', 'printout']
        : ['edible', 'printout'];

    if (!firstAction || !visibleActions.includes(firstAction)) return null;
    return currentActions.every((action) => action === firstAction) ? firstAction : null;
};

/**
 * Directly transforms every matching source row. The same target resolver is
 * used for active selection and candidate pricing, keeping all controls in sync.
 */
export const applyAiChatQuickActionMaterial = (
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    mode: AiChatQuickActionMode,
    action: AiChatTopperMaterialAction,
): { mainToppers: MainTopperUI[]; supportElements: SupportElementUI[]; changed: boolean } => {
    if (!mode || mode === 'edible-photo' || (mode === 'edible-toppers' && action === 'toy')) {
        return { mainToppers, supportElements, changed: false };
    }

    const targets = getTopperMaterialTargets(mainToppers, supportElements, mode);
    const mainTargetIds = new Set(targets.mainToppers.map((topper) => topper.id));
    const supportTargetIds = new Set(targets.supportElements.map((element) => element.id));
    let changed = false;
    const nextMainToppers = mainToppers.map((topper) => {
        if (!mainTargetIds.has(topper.id)) return topper;
        const nextTopper = updateMainTopperForAction(topper, mode, action);
        if (!hasDirectMaterialChange(topper, nextTopper)) return topper;
        changed = true;
        return nextTopper;
    });
    const nextSupportElements = supportElements.map((element) => {
        if (!supportTargetIds.has(element.id)) return element;
        const nextElement = updateSupportElementForAction(element, action);
        if (!hasDirectMaterialChange(element, nextElement)) return element;
        changed = true;
        return nextElement;
    });

    return { mainToppers: nextMainToppers, supportElements: nextSupportElements, changed };
};
