import {
    CAKE_THICKNESSES,
    DEFAULT_SIZE_MAP,
    DEFAULT_THICKNESS_MAP,
    FLAVOR_OPTIONS,
    THICKNESS_OPTIONS_MAP,
    getEquivalentCakeSizeForIcingBase,
    getEquivalentCakeTypeForIcingBase,
} from '@/constants';
import type {
    CakeFlavor,
    CakeInfoUI,
    CakeMessageType,
    CakeMessageUI,
    CakeThickness,
    CakeType,
    HybridAnalysisResult,
    IcingColorDetails,
    IcingDesign,
    IcingDesignUI,
    MainTopperType,
    MainTopperUI,
    Size,
    SupportElementType,
    SupportElementUI,
} from '@/types';

export const AI_CHAT_EDIT_OUTCOMES = [
    'design_change',
    'action_only',
    'restriction',
    'clarification',
    'noop',
] as const;

export type AiChatEditOutcome = typeof AI_CHAT_EDIT_OUTCOMES[number];

export const AI_CHAT_CAKE_FAMILIES = [
    '1 Tier',
    '2 Tier',
    '3 Tier',
    'Square',
    'Rectangle',
    'Bento',
    'Cupcake',
    'Bento Cupcake Set',
] as const;

export type AiChatCakeFamily = typeof AI_CHAT_CAKE_FAMILIES[number];

export const AI_CHAT_ICING_BASES = ['soft_icing', 'fondant'] as const;
export const AI_CHAT_CAKE_THICKNESSES = CAKE_THICKNESSES;
export const AI_CHAT_CAKE_FLAVORS = FLAVOR_OPTIONS;
export const AI_CHAT_ICING_COLOR_TYPES = [
    'single',
    'gradient',
    'multicolor',
    'gradient_2',
    'gradient_3',
    'abstract',
] as const;
export const AI_CHAT_SIZES = ['small', 'medium', 'large', 'tiny', 'xsmall', 'xlarge', 'mixed'] as const;
export const AI_CHAT_MESSAGE_TYPES = ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] as const;
export const AI_CHAT_MESSAGE_POSITIONS = ['top', 'side', 'base_board'] as const;
export const AI_CHAT_OPERATION_TYPES = ['add', 'update', 'remove'] as const;
export const AI_CHAT_ACTION_TYPES = ['add_to_cart', 'update_instructions'] as const;
export const AI_CHAT_TOPPER_CLASSIFICATIONS = ['hero', 'support', 'hero + support'] as const;

export const AI_CHAT_MAIN_TOPPER_TYPES = [
    'edible_3d_complex',
    'edible_3d_ordinary',
    'printout',
    'toy',
    'figurine',
    'cardstock',
    'edible_photo_top',
    'edible_photo_print',
    'edible_logo_2d',
    'candle',
    'edible_2d_shapes',
    'edible_flowers',
    'icing_doodle',
    'icing_doodle_intricate',
    'icing_doodle_intricate_top',
    'icing_palette_knife',
    'icing_palette_knife_intricate',
    'icing_brush_stroke',
    'icing_splatter',
    'icing_minimalist_spread',
    'icing_decorations',
    'meringue_pop',
    'plastic_ball',
] as const satisfies readonly MainTopperType[];

export const AI_CHAT_SUPPORT_ELEMENT_TYPES = [
    'edible_3d_support',
    'edible_2d_support',
    'chocolates',
    'sprinkles',
    'premium_sprinkles',
    'support_printout',
    'isomalt',
    'dragees',
    'edible_flowers',
    'edible_photo_side',
    'edible_photo_print',
    'icing_doodle',
    'icing_doodle_intricate_side',
    'icing_palette_knife',
    'icing_brush_stroke',
    'icing_splatter',
    'icing_minimalist_spread',
    'plastic_ball_regular',
    'plastic_ball_disco',
    'plastic_ball',
    'macarons',
    'meringue',
    'gumpaste_bundle',
    'candy',
    'gumpaste_panel',
    'icing_decorations',
    'gumpaste_creations',
    'marshmallows',
    'edible_3d_ordinary',
    'edible_lego_bricks',
    'fresh_flowers',
    'artificial_flowers',
    'thin_fabric_ribbon_bows',
    'satin_ribbon',
    'edible_lollipops',
    'printout',
] as const satisfies readonly SupportElementType[];

export interface AiChatTopperInput {
    type: MainTopperType;
    description: string;
    size: Size;
    quantity: number;
    groupId: string;
    classification: 'hero' | 'support' | 'hero + support';
    material?: string;
    color?: string;
    colors?: (string | null)[];
    x?: number;
    y?: number;
}

export interface AiChatSupportInput {
    type: SupportElementType;
    description: string;
    size: Size;
    groupId: string;
    material?: string;
    color?: string;
    colors?: (string | null)[];
    quantity?: number;
    x?: number;
    y?: number;
}

export interface AiChatMessageInput {
    type: CakeMessageType;
    text: string;
    position: 'top' | 'side' | 'base_board';
    color: string;
    x?: number;
    y?: number;
}

export type TargetedItemOperation<TItem> =
    | { operation: 'add'; item: TItem }
    | { operation: 'update'; id: string; changes: Partial<TItem> }
    | { operation: 'remove'; id: string };

export type TargetedMessageOperation = TargetedItemOperation<AiChatMessageInput>;
export type TargetedTopperOperation = TargetedItemOperation<AiChatTopperInput>;
export type TargetedSupportOperation = TargetedItemOperation<AiChatSupportInput>;

export interface AiChatDesignPatch {
    cake?: {
        family?: AiChatCakeFamily;
        thickness?: CakeThickness;
        size?: string;
        flavors?: CakeFlavor[];
    };
    icing?: {
        base?: IcingDesign['base'];
        colorType?: IcingDesign['color_type'];
        colors?: Partial<IcingColorDetails>;
        drip?: boolean;
        borderTop?: boolean;
        borderBase?: boolean;
        gumpasteBaseBoard?: boolean;
    };
    topperOperations?: TargetedTopperOperation[];
    supportOperations?: TargetedSupportOperation[];
    messageOperations?: TargetedMessageOperation[];
}

export type AiChatAction =
    | { type: 'add_to_cart' }
    | { type: 'update_instructions'; content: string };

export interface AiChatEditResponse {
    outcome: AiChatEditOutcome;
    patch?: AiChatDesignPatch;
    actions: AiChatAction[];
    message?: string;
}

export interface AiChatEditTargetSnapshot {
    mainToppers: readonly Pick<MainTopperUI, 'id'>[];
    supportElements: readonly Pick<SupportElementUI, 'id'>[];
    cakeMessages: readonly Pick<CakeMessageUI, 'id'>[];
}

export interface AiChatCustomizationSnapshot extends AiChatEditTargetSnapshot {
    cakeInfo: CakeInfoUI;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI;
    additionalInstructions: string;
    analysisResult: HybridAnalysisResult;
}

export type AiChatEditValidationResult =
    | { success: true; data: AiChatEditResponse }
    | { success: false; kind: 'invalid' | 'ambiguous_target'; errors: string[] };

export interface ApplyAiChatEditOptions {
    createId?: () => string;
}

export interface ApplyAiChatEditResult {
    nextState: AiChatCustomizationSnapshot;
    changedPaths: string[];
    requiresImageEdit: boolean;
    syncedAnalysisResult: HybridAnalysisResult;
}

const TOP_LEVEL_KEYS = ['outcome', 'patch', 'actions', 'message'] as const;
const PATCH_KEYS = ['cake', 'icing', 'topperOperations', 'supportOperations', 'messageOperations'] as const;
const CAKE_PATCH_KEYS = ['family', 'thickness', 'size', 'flavors'] as const;
const ICING_PATCH_KEYS = [
    'base',
    'colorType',
    'colors',
    'drip',
    'borderTop',
    'borderBase',
    'gumpasteBaseBoard',
] as const;
const ICING_COLOR_KEYS = ['side', 'top', 'gumpasteBaseBoardColor'] as const;
const TOPPER_INPUT_KEYS = [
    'type',
    'description',
    'size',
    'quantity',
    'groupId',
    'classification',
    'material',
    'color',
    'colors',
    'x',
    'y',
] as const;
const SUPPORT_INPUT_KEYS = [
    'type',
    'description',
    'size',
    'groupId',
    'material',
    'color',
    'colors',
    'quantity',
    'x',
    'y',
] as const;
const MESSAGE_INPUT_KEYS = ['type', 'text', 'position', 'color', 'x', 'y'] as const;
const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isMember = <T extends string>(value: unknown, values: readonly T[]): value is T =>
    typeof value === 'string' && values.includes(value as T);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[], path: string, errors: string[]) => {
    const allowed = new Set(keys);
    Object.keys(value).forEach(key => {
        if (!allowed.has(key)) errors.push(`${path}.${key} is not supported.`);
    });
};

const validateOptionalString = (
    value: Record<string, unknown>,
    key: string,
    path: string,
    errors: string[],
) => {
    if (key in value && !isNonEmptyString(value[key])) {
        errors.push(`${path}.${key} must be a non-empty string.`);
    }
};

const validateOptionalNumber = (
    value: Record<string, unknown>,
    key: string,
    path: string,
    errors: string[],
) => {
    if (key in value && !isFiniteNumber(value[key])) {
        errors.push(`${path}.${key} must be a finite number.`);
    }
};

const validateOptionalHex = (
    value: Record<string, unknown>,
    key: string,
    path: string,
    errors: string[],
) => {
    if (key in value && (typeof value[key] !== 'string' || !HEX_COLOR_PATTERN.test(value[key]))) {
        errors.push(`${path}.${key} must be a six-digit HEX color.`);
    }
};

const validateOptionalColorArray = (
    value: Record<string, unknown>,
    key: string,
    path: string,
    errors: string[],
) => {
    if (!(key in value)) return;
    const colors = value[key];
    if (!Array.isArray(colors) || colors.some(color => color !== null && (
        typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color)
    ))) {
        errors.push(`${path}.${key} must contain only six-digit HEX colors or null.`);
    }
};

const validateTopperInput = (
    input: unknown,
    path: string,
    errors: string[],
    partial: boolean,
) => {
    if (!isRecord(input)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    hasOnlyKeys(input, TOPPER_INPUT_KEYS, path, errors);
    if (!partial || 'type' in input) {
        if (!isMember(input.type, AI_CHAT_MAIN_TOPPER_TYPES)) errors.push(`${path}.type is invalid.`);
    }
    if (!partial || 'description' in input) {
        if (!isNonEmptyString(input.description)) errors.push(`${path}.description must be a non-empty string.`);
    }
    if (!partial || 'size' in input) {
        if (!isMember(input.size, AI_CHAT_SIZES)) errors.push(`${path}.size is invalid.`);
    }
    if (!partial || 'quantity' in input) {
        if (!Number.isInteger(input.quantity) || Number(input.quantity) < 1) {
            errors.push(`${path}.quantity must be a positive integer.`);
        }
    }
    if (!partial || 'groupId' in input) {
        if (!isNonEmptyString(input.groupId)) errors.push(`${path}.groupId must be a non-empty string.`);
    }
    if (!partial || 'classification' in input) {
        if (!isMember(input.classification, AI_CHAT_TOPPER_CLASSIFICATIONS)) {
            errors.push(`${path}.classification is invalid.`);
        }
    }
    validateOptionalString(input, 'material', path, errors);
    validateOptionalHex(input, 'color', path, errors);
    validateOptionalColorArray(input, 'colors', path, errors);
    validateOptionalNumber(input, 'x', path, errors);
    validateOptionalNumber(input, 'y', path, errors);
    if (partial && Object.keys(input).length === 0) errors.push(`${path} must include at least one change.`);
};

const validateSupportInput = (
    input: unknown,
    path: string,
    errors: string[],
    partial: boolean,
) => {
    if (!isRecord(input)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    hasOnlyKeys(input, SUPPORT_INPUT_KEYS, path, errors);
    if (!partial || 'type' in input) {
        if (!isMember(input.type, AI_CHAT_SUPPORT_ELEMENT_TYPES)) errors.push(`${path}.type is invalid.`);
    }
    if (!partial || 'description' in input) {
        if (!isNonEmptyString(input.description)) errors.push(`${path}.description must be a non-empty string.`);
    }
    if (!partial || 'size' in input) {
        if (!isMember(input.size, AI_CHAT_SIZES)) errors.push(`${path}.size is invalid.`);
    }
    if (!partial || 'groupId' in input) {
        if (!isNonEmptyString(input.groupId)) errors.push(`${path}.groupId must be a non-empty string.`);
    }
    validateOptionalString(input, 'material', path, errors);
    validateOptionalHex(input, 'color', path, errors);
    validateOptionalColorArray(input, 'colors', path, errors);
    validateOptionalNumber(input, 'x', path, errors);
    validateOptionalNumber(input, 'y', path, errors);
    if ('quantity' in input && (!Number.isInteger(input.quantity) || Number(input.quantity) < 1)) {
        errors.push(`${path}.quantity must be a positive integer.`);
    }
    if (partial && Object.keys(input).length === 0) errors.push(`${path} must include at least one change.`);
};

const validateMessageInput = (
    input: unknown,
    path: string,
    errors: string[],
    partial: boolean,
) => {
    if (!isRecord(input)) {
        errors.push(`${path} must be an object.`);
        return;
    }
    hasOnlyKeys(input, MESSAGE_INPUT_KEYS, path, errors);
    if (!partial || 'type' in input) {
        if (!isMember(input.type, AI_CHAT_MESSAGE_TYPES)) errors.push(`${path}.type is invalid.`);
    }
    if (!partial || 'text' in input) {
        if (!isNonEmptyString(input.text)) errors.push(`${path}.text must be a non-empty string.`);
    }
    if (!partial || 'position' in input) {
        if (!isMember(input.position, AI_CHAT_MESSAGE_POSITIONS)) errors.push(`${path}.position is invalid.`);
    }
    if (!partial && !('color' in input)) {
        errors.push(`${path}.color must be a six-digit HEX color.`);
    } else {
        validateOptionalHex(input, 'color', path, errors);
    }
    validateOptionalNumber(input, 'x', path, errors);
    validateOptionalNumber(input, 'y', path, errors);
    if (partial && Object.keys(input).length === 0) errors.push(`${path} must include at least one change.`);
};

const validateOperations = (
    operations: unknown,
    path: string,
    errors: string[],
    ambiguousErrors: string[],
    targetIds: readonly string[] | undefined,
    validateInput: (input: unknown, path: string, errors: string[], partial: boolean) => void,
) => {
    if (!Array.isArray(operations) || operations.length === 0) {
        errors.push(`${path} must be a non-empty array.`);
        return;
    }

    const targetedIds = new Set<string>();
    operations.forEach((operation, index) => {
        const operationPath = `${path}[${index}]`;
        if (!isRecord(operation)) {
            errors.push(`${operationPath} must be an object.`);
            return;
        }

        const kind = operation.operation;
        if (!isMember(kind, AI_CHAT_OPERATION_TYPES)) {
            errors.push(`${operationPath}.operation is invalid.`);
            return;
        }

        if (kind === 'add') {
            hasOnlyKeys(operation, ['operation', 'item'], operationPath, errors);
            validateInput(operation.item, `${operationPath}.item`, errors, false);
            return;
        }

        hasOnlyKeys(
            operation,
            kind === 'update' ? ['operation', 'id', 'changes'] : ['operation', 'id'],
            operationPath,
            errors,
        );
        if (!isNonEmptyString(operation.id)) {
            ambiguousErrors.push(`${operationPath}.id must identify exactly one existing item.`);
        } else {
            const matchingTargetCount = targetIds?.filter(id => id === operation.id).length;
            if (targetIds && matchingTargetCount !== 1) {
                ambiguousErrors.push(`${operationPath}.id does not identify exactly one existing item.`);
            }
            if (targetedIds.has(operation.id)) {
                ambiguousErrors.push(`${operationPath}.id is targeted more than once.`);
            }
            targetedIds.add(operation.id);
        }
        if (kind === 'update') {
            validateInput(operation.changes, `${operationPath}.changes`, errors, true);
        }
    });
};

const validatePatch = (
    patch: unknown,
    errors: string[],
    ambiguousErrors: string[],
    targets?: AiChatEditTargetSnapshot,
) => {
    if (!isRecord(patch)) {
        errors.push('patch must be an object.');
        return;
    }
    hasOnlyKeys(patch, PATCH_KEYS, 'patch', errors);
    if (Object.keys(patch).length === 0) errors.push('patch must include at least one change.');

    if ('cake' in patch) {
        if (!isRecord(patch.cake)) {
            errors.push('patch.cake must be an object.');
        } else {
            hasOnlyKeys(patch.cake, CAKE_PATCH_KEYS, 'patch.cake', errors);
            if (Object.keys(patch.cake).length === 0) errors.push('patch.cake must include at least one change.');
            if ('family' in patch.cake && !isMember(patch.cake.family, AI_CHAT_CAKE_FAMILIES)) {
                errors.push('patch.cake.family is invalid.');
            }
            if ('thickness' in patch.cake && !isMember(patch.cake.thickness, CAKE_THICKNESSES)) {
                errors.push('patch.cake.thickness is invalid.');
            }
            if ('size' in patch.cake && !isNonEmptyString(patch.cake.size)) {
                errors.push('patch.cake.size must be a non-empty string.');
            }
            if ('flavors' in patch.cake && (
                !Array.isArray(patch.cake.flavors)
                || patch.cake.flavors.length === 0
                || patch.cake.flavors.some(flavor => !isMember(flavor, FLAVOR_OPTIONS))
            )) {
                errors.push('patch.cake.flavors must contain only supported cake flavors.');
            }
        }
    }

    if ('icing' in patch) {
        if (!isRecord(patch.icing)) {
            errors.push('patch.icing must be an object.');
        } else {
            const icing = patch.icing;
            hasOnlyKeys(icing, ICING_PATCH_KEYS, 'patch.icing', errors);
            if (Object.keys(icing).length === 0) errors.push('patch.icing must include at least one change.');
            if ('base' in icing && !isMember(icing.base, AI_CHAT_ICING_BASES)) {
                errors.push('patch.icing.base is invalid.');
            }
            if ('colorType' in icing && !isMember(icing.colorType, AI_CHAT_ICING_COLOR_TYPES)) {
                errors.push('patch.icing.colorType is invalid.');
            }
            if ('colors' in icing) {
                if (!isRecord(icing.colors)) {
                    errors.push('patch.icing.colors must be an object.');
                } else {
                    hasOnlyKeys(icing.colors, ICING_COLOR_KEYS, 'patch.icing.colors', errors);
                    if (Object.keys(icing.colors).length === 0) {
                        errors.push('patch.icing.colors must include at least one color.');
                    }
                    Object.entries(icing.colors).forEach(([key, value]) => {
                        if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
                            errors.push(`patch.icing.colors.${key} must be a six-digit HEX color.`);
                        }
                    });
                }
            }
            ['drip', 'borderTop', 'borderBase', 'gumpasteBaseBoard'].forEach(key => {
                if (key in icing && typeof icing[key] !== 'boolean') {
                    errors.push(`patch.icing.${key} must be a boolean.`);
                }
            });
        }
    }

    if ('topperOperations' in patch) {
        validateOperations(
            patch.topperOperations,
            'patch.topperOperations',
            errors,
            ambiguousErrors,
            targets?.mainToppers.map(item => item.id),
            validateTopperInput,
        );
    }
    if ('supportOperations' in patch) {
        validateOperations(
            patch.supportOperations,
            'patch.supportOperations',
            errors,
            ambiguousErrors,
            targets?.supportElements.map(item => item.id),
            validateSupportInput,
        );
    }
    if ('messageOperations' in patch) {
        validateOperations(
            patch.messageOperations,
            'patch.messageOperations',
            errors,
            ambiguousErrors,
            targets?.cakeMessages.map(item => item.id),
            validateMessageInput,
        );
    }
}

export function validateAiChatEditResponse(
    input: unknown,
    targets?: AiChatEditTargetSnapshot,
): AiChatEditValidationResult {
    const errors: string[] = [];
    const ambiguousErrors: string[] = [];
    if (!isRecord(input)) {
        return { success: false, kind: 'invalid', errors: ['Response must be an object.'] };
    }

    hasOnlyKeys(input, TOP_LEVEL_KEYS, 'response', errors);
    if (!isMember(input.outcome, AI_CHAT_EDIT_OUTCOMES)) errors.push('outcome is invalid.');
    if (!Array.isArray(input.actions)) {
        errors.push('actions must be an array.');
    } else {
        input.actions.forEach((action, index) => {
            const path = `actions[${index}]`;
            if (!isRecord(action) || !isMember(action.type, AI_CHAT_ACTION_TYPES)) {
                errors.push(`${path}.type is invalid.`);
                return;
            }
            hasOnlyKeys(action, action.type === 'update_instructions' ? ['type', 'content'] : ['type'], path, errors);
            if (action.type === 'update_instructions' && !isNonEmptyString(action.content)) {
                errors.push(`${path}.content must be a non-empty string.`);
            }
        });
    }
    if ('message' in input && !isNonEmptyString(input.message)) {
        errors.push('message must be a non-empty string when provided.');
    }
    if ('patch' in input) validatePatch(input.patch, errors, ambiguousErrors, targets);

    if (input.outcome === 'design_change' && !('patch' in input)) {
        errors.push('design_change requires a patch.');
    }
    if (input.outcome === 'action_only' && (!Array.isArray(input.actions) || input.actions.length === 0)) {
        errors.push('action_only requires at least one action.');
    }
    if (isMember(input.outcome, ['restriction', 'clarification'] as const) && !isNonEmptyString(input.message)) {
        errors.push(`${input.outcome} requires a message.`);
    }
    if (isMember(input.outcome, ['restriction', 'clarification'] as const)
        && Array.isArray(input.actions) && input.actions.length > 0) {
        errors.push(`${input.outcome} cannot include actions.`);
    }
    if (input.outcome !== 'design_change' && 'patch' in input) {
        errors.push(`${String(input.outcome)} cannot include a design patch.`);
    }
    if (input.outcome === 'noop' && Array.isArray(input.actions) && input.actions.length > 0) {
        errors.push('noop cannot include actions.');
    }

    if (ambiguousErrors.length > 0) {
        return { success: false, kind: 'ambiguous_target', errors: [...errors, ...ambiguousErrors] };
    }
    if (errors.length > 0) return { success: false, kind: 'invalid', errors };
    return { success: true, data: input as unknown as AiChatEditResponse };
}

const getCakeFamily = (cakeType: CakeType): AiChatCakeFamily => {
    switch (cakeType) {
        case '1 Tier Fondant': return '1 Tier';
        case '2 Tier Fondant': return '2 Tier';
        case '3 Tier Fondant': return '3 Tier';
        case 'Square Fondant': return 'Square';
        case 'Rectangle Fondant': return 'Rectangle';
        default: return cakeType;
    }
};

const getTierCount = (family: AiChatCakeFamily): number => {
    if (family === '2 Tier') return 2;
    if (family === '3 Tier') return 3;
    return 1;
};

const supportsFondant = (family: AiChatCakeFamily): boolean =>
    family === '1 Tier'
    || family === '2 Tier'
    || family === '3 Tier'
    || family === 'Square'
    || family === 'Rectangle';

const resolveCakeType = (family: AiChatCakeFamily, base: IcingDesign['base']): CakeType => {
    if (!supportsFondant(family)) return family;
    return getEquivalentCakeTypeForIcingBase(family, base);
};

const resizeFlavors = (flavors: CakeFlavor[], count: number): CakeFlavor[] =>
    Array.from({ length: count }, (_, index) => flavors[index] ?? flavors[flavors.length - 1] ?? 'Chocolate Cake');

const pushChangedPath = (changedPaths: string[], path: string) => {
    if (!changedPaths.includes(path)) changedPaths.push(path);
};

const applyTopperOperations = (
    current: MainTopperUI[],
    operations: TargetedTopperOperation[] | undefined,
    createId: () => string,
    changedPaths: string[],
): MainTopperUI[] => {
    if (!operations) return current;
    let next = current;
    operations.forEach(operation => {
        if (operation.operation === 'add') {
            const id = createId();
            const { groupId, ...item } = operation.item;
            const added: MainTopperUI = {
                ...item,
                group_id: groupId,
                id,
                isEnabled: true,
                price: 0,
                original_type: item.type,
                original_color: item.color,
                original_colors: item.colors,
            };
            next = [...next, added];
            pushChangedPath(changedPaths, `mainToppers.${id}`);
            return;
        }
        const index = next.findIndex(item => item.id === operation.id);
        if (index < 0) return;
        if (operation.operation === 'remove') {
            next = next.filter(item => item.id !== operation.id);
            pushChangedPath(changedPaths, `mainToppers.${operation.id}`);
            return;
        }

        const currentItem = next[index];
        const { groupId, ...changes } = operation.changes;
        const mappedChanges: Partial<MainTopperUI> = {
            ...changes,
            ...(groupId === undefined ? {} : { group_id: groupId }),
        };
        if (mappedChanges.type === 'printout' && !currentItem.printout_source_type) {
            const sourceType = currentItem.type !== 'printout'
                ? currentItem.type
                : currentItem.original_type !== 'printout'
                    ? currentItem.original_type
                    : undefined;
            if (sourceType) mappedChanges.printout_source_type = sourceType;
        }
        const changedEntries = Object.entries(mappedChanges).filter(([key, value]) => {
            const currentValue = currentItem[key as keyof MainTopperUI];
            return Array.isArray(value)
                ? JSON.stringify(value) !== JSON.stringify(currentValue)
                : value !== currentValue;
        });
        if (changedEntries.length === 0) return;
        next = next.map((item, itemIndex) => itemIndex === index ? { ...item, ...mappedChanges } : item);
        changedEntries.forEach(([key]) => pushChangedPath(changedPaths, `mainToppers.${operation.id}.${key}`));
    });
    return next;
};

const applySupportOperations = (
    current: SupportElementUI[],
    operations: TargetedSupportOperation[] | undefined,
    createId: () => string,
    changedPaths: string[],
): SupportElementUI[] => {
    if (!operations) return current;
    let next = current;
    operations.forEach(operation => {
        if (operation.operation === 'add') {
            const id = createId();
            const { groupId, ...item } = operation.item;
            const added: SupportElementUI = {
                ...item,
                group_id: groupId,
                id,
                isEnabled: true,
                price: 0,
                original_type: item.type,
                original_color: item.color,
                original_colors: item.colors,
            };
            next = [...next, added];
            pushChangedPath(changedPaths, `supportElements.${id}`);
            return;
        }
        const index = next.findIndex(item => item.id === operation.id);
        if (index < 0) return;
        if (operation.operation === 'remove') {
            next = next.filter(item => item.id !== operation.id);
            pushChangedPath(changedPaths, `supportElements.${operation.id}`);
            return;
        }

        const currentItem = next[index];
        const { groupId, ...changes } = operation.changes;
        const mappedChanges: Partial<SupportElementUI> = {
            ...changes,
            ...(groupId === undefined ? {} : { group_id: groupId }),
        };
        if (mappedChanges.type === 'support_printout' && !currentItem.printout_source_type) {
            const sourceType = currentItem.type !== 'support_printout'
                ? currentItem.type
                : currentItem.original_type !== 'support_printout'
                    ? currentItem.original_type
                    : undefined;
            if (sourceType) mappedChanges.printout_source_type = sourceType;
        }
        const changedEntries = Object.entries(mappedChanges).filter(([key, value]) => {
            const currentValue = currentItem[key as keyof SupportElementUI];
            return Array.isArray(value)
                ? JSON.stringify(value) !== JSON.stringify(currentValue)
                : value !== currentValue;
        });
        if (changedEntries.length === 0) return;
        next = next.map((item, itemIndex) => itemIndex === index ? { ...item, ...mappedChanges } : item);
        changedEntries.forEach(([key]) => pushChangedPath(changedPaths, `supportElements.${operation.id}.${key}`));
    });
    return next;
};

const applyMessageOperations = (
    current: CakeMessageUI[],
    operations: TargetedMessageOperation[] | undefined,
    createId: () => string,
    changedPaths: string[],
): CakeMessageUI[] => {
    if (!operations) return current;
    let next = current;
    operations.forEach(operation => {
        if (operation.operation === 'add') {
            const id = createId();
            const added: CakeMessageUI = {
                ...operation.item,
                id,
                isEnabled: true,
                price: 0,
                originalMessage: { ...operation.item },
                isPlaceholder: false,
            };
            next = [...next, added];
            pushChangedPath(changedPaths, `cakeMessages.${id}`);
            return;
        }
        const index = next.findIndex(item => item.id === operation.id);
        if (index < 0) return;
        if (operation.operation === 'remove') {
            next = next.filter(item => item.id !== operation.id);
            pushChangedPath(changedPaths, `cakeMessages.${operation.id}`);
            return;
        }

        const currentItem = next[index];
        const changedEntries = Object.entries(operation.changes).filter(([key, value]) =>
            value !== currentItem[key as keyof CakeMessageUI]
        );
        if (changedEntries.length === 0) return;
        next = next.map((item, itemIndex) => itemIndex === index ? { ...item, ...operation.changes } : item);
        changedEntries.forEach(([key]) => pushChangedPath(changedPaths, `cakeMessages.${operation.id}.${key}`));
    });
    return next;
};

const syncAnalysis = (
    previous: HybridAnalysisResult,
    nextState: Omit<AiChatCustomizationSnapshot, 'analysisResult'>,
): HybridAnalysisResult => ({
    ...previous,
    cakeType: nextState.cakeInfo.type,
    cakeThickness: nextState.cakeInfo.thickness,
    cakeSize: nextState.cakeInfo.size,
    main_toppers: nextState.mainToppers.map(item => ({ ...item })),
    support_elements: nextState.supportElements.map(item => ({ ...item })),
    cake_messages: nextState.cakeMessages.map(item => ({
        id: item.id,
        isEnabled: item.isEnabled,
        type: item.type,
        text: item.text,
        position: item.position,
        color: item.color,
        x: item.x,
        y: item.y,
        bbox: item.bbox,
    })),
    icing_design: {
        base: nextState.icingDesign.base,
        color_type: nextState.icingDesign.color_type,
        colors: { ...nextState.icingDesign.colors },
        border_top: nextState.icingDesign.border_top,
        border_base: nextState.icingDesign.border_base,
        drip: nextState.icingDesign.drip,
        gumpasteBaseBoard: nextState.icingDesign.gumpasteBaseBoard,
    },
});

export function applyAiChatEdit(
    current: AiChatCustomizationSnapshot,
    response: AiChatEditResponse,
    options: ApplyAiChatEditOptions = {},
): ApplyAiChatEditResult {
    const changedPaths: string[] = [];
    const createId = options.createId ?? (() => crypto.randomUUID());
    const patch = response.outcome === 'design_change' ? response.patch : undefined;

    let cakeInfo = current.cakeInfo;
    let icingDesign = current.icingDesign;

    if (patch?.cake || patch?.icing) {
        const currentFamily = getCakeFamily(current.cakeInfo.type);
        const isBentoToFondant = currentFamily === 'Bento'
            && patch.cake?.family === undefined
            && patch.icing?.base === 'fondant';
        const requestedFamily = isBentoToFondant
            ? '1 Tier'
            : patch.cake?.family ?? currentFamily;
        const requestedBase = patch.icing?.base ?? current.icingDesign.base;
        const nextBase = supportsFondant(requestedFamily) ? requestedBase : 'soft_icing';
        const nextType = resolveCakeType(requestedFamily, nextBase);
        const hasTypeChanged = nextType !== current.cakeInfo.type;

        const nextCakeInfo: CakeInfoUI = { ...current.cakeInfo };
        if (hasTypeChanged) {
            nextCakeInfo.type = nextType;
            pushChangedPath(changedPaths, 'cakeInfo.type');
        }

        if (patch.cake?.size !== undefined) {
            if (patch.cake.size !== current.cakeInfo.size) {
                nextCakeInfo.size = patch.cake.size;
                pushChangedPath(changedPaths, 'cakeInfo.size');
            }
        } else if (isBentoToFondant) {
            nextCakeInfo.size = DEFAULT_SIZE_MAP[nextType];
            pushChangedPath(changedPaths, 'cakeInfo.size');
        } else if (patch.icing?.base !== undefined && hasTypeChanged
            && current.cakeInfo.type !== 'Bento' && nextType !== 'Bento') {
            const equivalentSize = getEquivalentCakeSizeForIcingBase(current.cakeInfo.size, nextBase);
            if (equivalentSize !== current.cakeInfo.size) {
                nextCakeInfo.size = equivalentSize;
                pushChangedPath(changedPaths, 'cakeInfo.size');
            }
        }

        const requestedThickness = patch.cake?.thickness;
        const nextThickness = requestedThickness
            ? (THICKNESS_OPTIONS_MAP[nextType]?.includes(requestedThickness)
                ? requestedThickness
                : DEFAULT_THICKNESS_MAP[nextType])
            : (THICKNESS_OPTIONS_MAP[nextType]?.includes(current.cakeInfo.thickness)
                ? current.cakeInfo.thickness
                : DEFAULT_THICKNESS_MAP[nextType]);
        if (nextThickness !== current.cakeInfo.thickness) {
            nextCakeInfo.thickness = nextThickness;
            pushChangedPath(changedPaths, 'cakeInfo.thickness');
        }

        const currentTierCount = getTierCount(currentFamily);
        const nextTierCount = getTierCount(requestedFamily);
        const requestedFlavors = patch.cake?.flavors;
        const nextFlavors = currentTierCount !== nextTierCount
            ? resizeFlavors(requestedFlavors ?? current.cakeInfo.flavors, nextTierCount)
            : requestedFlavors ?? current.cakeInfo.flavors;
        if (JSON.stringify(nextFlavors) !== JSON.stringify(current.cakeInfo.flavors)) {
            nextCakeInfo.flavors = [...nextFlavors];
            pushChangedPath(changedPaths, 'cakeInfo.flavors');
        }
        cakeInfo = nextCakeInfo;

        const nextIcingDesign: IcingDesignUI = {
            ...current.icingDesign,
            colors: { ...current.icingDesign.colors },
        };
        if (nextBase !== current.icingDesign.base) {
            nextIcingDesign.base = nextBase;
            pushChangedPath(changedPaths, 'icingDesign.base');
        }
        if (patch.icing?.colorType !== undefined && patch.icing.colorType !== current.icingDesign.color_type) {
            nextIcingDesign.color_type = patch.icing.colorType;
            pushChangedPath(changedPaths, 'icingDesign.color_type');
        }
        if (patch.icing?.colors) {
            Object.entries(patch.icing.colors).forEach(([key, value]) => {
                const colorKey = key as keyof IcingColorDetails;
                if (value !== undefined && value !== current.icingDesign.colors[colorKey]) {
                    nextIcingDesign.colors[colorKey] = value;
                    pushChangedPath(changedPaths, `icingDesign.colors.${key}`);
                }
            });
        }
        const booleanMappings = [
            ['drip', 'drip'],
            ['borderTop', 'border_top'],
            ['borderBase', 'border_base'],
            ['gumpasteBaseBoard', 'gumpasteBaseBoard'],
        ] as const;
        booleanMappings.forEach(([patchKey, stateKey]) => {
            const value = patch.icing?.[patchKey];
            if (value !== undefined && value !== current.icingDesign[stateKey]) {
                nextIcingDesign[stateKey] = value;
                pushChangedPath(changedPaths, `icingDesign.${stateKey}`);
            }
        });

        // Bento cannot represent these fields; normalize them when a family change selects Bento.
        if (requestedFamily === 'Bento') {
            if (nextIcingDesign.border_base) {
                nextIcingDesign.border_base = false;
                pushChangedPath(changedPaths, 'icingDesign.border_base');
            }
            if (nextIcingDesign.gumpasteBaseBoard) {
                nextIcingDesign.gumpasteBaseBoard = false;
                pushChangedPath(changedPaths, 'icingDesign.gumpasteBaseBoard');
            }
        }
        icingDesign = nextIcingDesign;
    }

    const mainToppers = applyTopperOperations(
        current.mainToppers,
        patch?.topperOperations,
        createId,
        changedPaths,
    );
    const supportElements = applySupportOperations(
        current.supportElements,
        patch?.supportOperations,
        createId,
        changedPaths,
    );
    let cakeMessages = applyMessageOperations(
        current.cakeMessages,
        patch?.messageOperations,
        createId,
        changedPaths,
    );
    if (patch?.cake?.family === 'Bento') {
        const retainedMessages = cakeMessages.filter(message => message.position !== 'base_board');
        if (retainedMessages.length !== cakeMessages.length) {
            cakeMessages
                .filter(message => message.position === 'base_board')
                .forEach(message => pushChangedPath(changedPaths, `cakeMessages.${message.id}`));
            cakeMessages = retainedMessages;
        }
    }

    if (changedPaths.length === 0) {
        return {
            nextState: current,
            changedPaths,
            requiresImageEdit: false,
            syncedAnalysisResult: current.analysisResult,
        };
    }

    const stateWithoutAnalysis = {
        cakeInfo,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions: current.additionalInstructions,
    };
    const syncedAnalysisResult = syncAnalysis(current.analysisResult, stateWithoutAnalysis);
    const nextState: AiChatCustomizationSnapshot = {
        ...stateWithoutAnalysis,
        analysisResult: syncedAnalysisResult,
    };

    return {
        nextState,
        changedPaths,
        requiresImageEdit: changedPaths.some(path => path !== 'cakeInfo.flavors'),
        syncedAnalysisResult,
    };
}
