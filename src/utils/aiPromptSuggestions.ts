import { FLAVOR_OPTIONS, THICKNESS_OPTIONS_MAP } from '@/constants';
import { BasePriceInfo, CakeInfoUI, CakeType, HybridAnalysisResult, MainTopper, SupportElement } from '@/types';
import { hexToColorNameProse } from '@/utils/colorUtils';

const HEX_COLOR_REGEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const COLORABLE_ITEM_TYPES = new Set([
    'edible_3d_complex', 'edible_3d_ordinary', 'edible_3d_support', 'edible_2d_support', 'edible_flowers', 'icing_doodle',
    'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop',
]);
const MESSAGE_POSITION_LABELS = {
    top: 'top',
    side: 'front',
    base_board: 'base board',
} as const;

type SuggestionOptions = {
    cakeInfo?: CakeInfoUI | null;
    basePriceOptions?: BasePriceInfo[] | null;
};

type EditableDecor = (MainTopper | SupportElement) & {
    original_type?: string;
    original_color?: string;
};

const DEFERRED_CAKE_DETAIL_QUERY_TERMS = {
    height: ['height', 'tall', 'thick', 'thickness', 'inch', 'inches'],
    size: ['size', 'round', 'square', 'inch', 'inches'],
    flavor: ['flavor', 'flavour', 'taste'],
} as const;

const cleanText = (value?: string | null): string => value?.trim().replace(/\s+/g, ' ') ?? '';

const quotePromptValue = (value?: string | null): string => {
    const cleaned = cleanText(value).replace(/"/g, "'");
    return cleaned ? `"${cleaned}"` : '';
};

const formatPromptColor = (value?: string | null): string | null => {
    const cleaned = cleanText(value);
    if (!cleaned) return null;

    if (HEX_COLOR_REGEX.test(cleaned)) {
        const normalizedHex = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
        return hexToColorNameProse(normalizedHex).toLowerCase();
    }

    return cleaned.toLowerCase();
};

const addSuggestion = (suggestions: string[], value?: string | null) => {
    const cleaned = cleanText(value);
    if (cleaned) suggestions.push(cleaned);
};

export const shouldShowAiPromptSuggestion = (suggestion: string, query: string): boolean => {
    const normalizedSuggestion = cleanText(suggestion).toLowerCase();
    const normalizedQuery = cleanText(query).toLowerCase();

    const queryIncludesAny = (terms: readonly string[]) => terms.some(term => normalizedQuery.includes(term));

    if (normalizedSuggestion.startsWith('change the cake height from ')) {
        return normalizedQuery ? queryIncludesAny(DEFERRED_CAKE_DETAIL_QUERY_TERMS.height) : false;
    }

    if (normalizedSuggestion.startsWith('change the cake size from ')) {
        return normalizedQuery ? queryIncludesAny(DEFERRED_CAKE_DETAIL_QUERY_TERMS.size) : false;
    }

    if (normalizedSuggestion.startsWith('change the cake flavor from ')) {
        return normalizedQuery ? queryIncludesAny(DEFERRED_CAKE_DETAIL_QUERY_TERMS.flavor) : false;
    }

    return true;
};

const getOriginalType = (item: EditableDecor): string => item.original_type || item.type;

const hasHumanFigureDescription = (description?: string | null): boolean => {
    const normalized = cleanText(description).toLowerCase();
    return ['person', 'character', 'human', 'figure', 'silhouette'].some(keyword => normalized.includes(keyword));
};

const canChangeDecorColor = (item: EditableDecor): boolean => {
    const originalType = getOriginalType(item);
    return originalType === 'icing_doodle'
        || COLORABLE_ITEM_TYPES.has(originalType)
        || Boolean(cleanText(item.color) || cleanText(item.original_color));
};

const canChangeDecorMultipleColors = (item: EditableDecor): boolean => {
    const originalType = getOriginalType(item);
    return originalType === 'icing_palette_knife' && Array.isArray(item.colors) && item.colors.length > 0;
};

const canChangeTopperMaterial = (topper: EditableDecor): boolean => {
    const originalType = getOriginalType(topper);
    const description = cleanText(topper.description).toLowerCase();
    const isNumberTopper = description.includes('number') && ['edible_3d_complex', 'edible_3d_ordinary', 'candle', 'printout'].includes(originalType);
    const is3DFlower = ['edible_3d_complex', 'edible_3d_ordinary'].includes(originalType) && description.includes('flower');

    return isNumberTopper
        || originalType === 'printout'
        || (['edible_3d_complex', 'edible_3d_ordinary', 'edible_photo_top'].includes(originalType) && !is3DFlower && !isNumberTopper)
        || originalType === 'cardstock'
        || ['toy', 'figurine', 'plastic_ball'].includes(originalType);
};

const canChangeSupportMaterial = (element: EditableDecor): boolean => {
    const originalType = getOriginalType(element);
    return ['edible_photo_side', 'edible_3d_support', 'edible_2d_support', 'support_printout'].includes(originalType);
};

const canReplaceDecorImage = (item: EditableDecor): boolean => {
    const itemType = item.type;
    const isPrintoutOrPhoto = ['printout', 'edible_photo_top', 'support_printout', 'edible_photo_side'].includes(itemType);
    const isHumanFigure = hasHumanFigureDescription(item.description);
    const isReplaceableIcingFigure = ['icing_doodle', 'icing_palette_knife'].includes(itemType) && isHumanFigure;
    const isReplaceableGumpasteFigure = ['edible_3d_complex', 'edible_3d_ordinary', 'edible_3d_support'].includes(itemType) && isHumanFigure;

    return isPrintoutOrPhoto || isReplaceableIcingFigure || isReplaceableGumpasteFigure;
};

const getMessagePositionLabel = (position: keyof typeof MESSAGE_POSITION_LABELS): string => MESSAGE_POSITION_LABELS[position];

const getFlavorLabels = (count: number): string[] => {
    if (count === 2) return ['top tier flavor', 'bottom tier flavor'];
    if (count === 3) return ['top tier flavor', 'middle tier flavor', 'bottom tier flavor'];
    return ['cake flavor'];
};

const getAvailableFlavors = (cakeType?: CakeType | null): string[] => {
    if (cakeType === 'Bento') {
        return FLAVOR_OPTIONS.filter(flavor => flavor !== 'Ube Cake' && flavor !== 'Mocha Cake');
    }
    return FLAVOR_OPTIONS;
};

const getTopperReplacementSuggestion = (topper: MainTopper): string => {
    const description = cleanText(topper.description).toLowerCase();

    if (topper.type === 'candle' || description.includes('number') || description.includes('candle')) {
        return 'a gold candle set';
    }

    if (topper.type === 'edible_flowers' || description.includes('flower') || description.includes('rose')) {
        return 'butterflies';
    }

    if (description.includes('butterfly')) {
        return 'fresh flowers';
    }

    if (topper.type === 'edible_photo_top' || description.includes('photo') || description.includes('picture')) {
        return 'a custom name topper';
    }

    if (topper.type === 'toy' || topper.type === 'figurine' || description.includes('figurine') || description.includes('character')) {
        return 'a custom name topper';
    }

    if (topper.type === 'printout' || topper.type === 'cardstock' || description.includes('name topper')) {
        return 'fresh flowers';
    }

    return 'fresh flowers';
};

export const buildAiChatPromptSuggestions = (
    analysis?: HybridAnalysisResult | null,
    options: SuggestionOptions = {}
): string[] => {
    if (!analysis && !options.cakeInfo) return [];

    const suggestions: string[] = [];
    const { cakeInfo, basePriceOptions } = options;
    const icingDesign = analysis?.icing_design;
    const colors = icingDesign?.colors;
    const resolvedCakeType = cakeInfo?.type || analysis?.cakeType;
    const resolvedThickness = cakeInfo?.thickness || analysis?.cakeThickness;
    const isBento = resolvedCakeType === 'Bento';

    const topIcingColor = formatPromptColor(colors?.top);
    const sideIcingColor = formatPromptColor(colors?.side);
    const primaryIcingColor = sideIcingColor || topIcingColor || formatPromptColor(colors?.borderTop) || 'white';
    const dripColor = formatPromptColor(colors?.drip) || topIcingColor || primaryIcingColor;
    const topBorderColor = formatPromptColor(colors?.borderTop) || primaryIcingColor;
    const bottomBorderColor = formatPromptColor(colors?.borderBase) || primaryIcingColor;
    const baseBoardColor = formatPromptColor(colors?.gumpasteBaseBoardColor) || 'white';
    if (resolvedCakeType) {
        addSuggestion(suggestions, `change the cake type from ${resolvedCakeType} to ...`);
    }

    if (resolvedCakeType && resolvedThickness && (THICKNESS_OPTIONS_MAP[resolvedCakeType]?.length || 0) > 1) {
        addSuggestion(suggestions, `change the cake height from ${resolvedThickness} to ...`);
    }

    if (cakeInfo?.size && (basePriceOptions?.length || 0) > 1) {
        addSuggestion(suggestions, `change the cake size from ${cakeInfo.size} to ...`);
    }

    if (cakeInfo?.flavors?.length) {
        const availableFlavors = getAvailableFlavors(resolvedCakeType);
        if (availableFlavors.length > 1) {
            getFlavorLabels(cakeInfo.flavors.length).forEach((label, index) => {
                const flavor = cleanText(cakeInfo.flavors[index]);
                if (!flavor) return;
                addSuggestion(suggestions, `change the ${label} from ${flavor.toLowerCase()} to ...`);
            });
        }
    }

    if (icingDesign) {
        if (topIcingColor && sideIcingColor && topIcingColor !== sideIcingColor) {
            addSuggestion(suggestions, `change the ${topIcingColor} top icing to ...`);
            addSuggestion(suggestions, `change the ${sideIcingColor} side icing to ...`);
        } else {
            addSuggestion(suggestions, `change the ${primaryIcingColor} icing to ...`);
        }

        if (icingDesign.drip) {
            addSuggestion(suggestions, `change the ${dripColor} drip to ...`);
            addSuggestion(suggestions, 'remove the drip');
        } else {
            addSuggestion(suggestions, 'add a ... drip on the cake');
        }

        if (icingDesign.border_top) {
            addSuggestion(suggestions, `change the ${topBorderColor} top border to ...`);
            addSuggestion(suggestions, 'remove the top border');
        } else {
            addSuggestion(suggestions, 'add a ... top border');
        }

        if (!isBento) {
            if (icingDesign.border_base) {
                addSuggestion(suggestions, `change the ${bottomBorderColor} bottom border to ...`);
                addSuggestion(suggestions, 'remove the bottom border');
            } else {
                addSuggestion(suggestions, 'add a ... bottom border');
            }

            if (icingDesign.gumpasteBaseBoard) {
                addSuggestion(suggestions, `change the ${baseBoardColor} covered base board color to ...`);
                addSuggestion(suggestions, 'remove the gumpaste covered base board');
            } else {
                addSuggestion(suggestions, 'add a ... gumpaste covered base board');
            }
        }
    }

    const visibleMessagePositions = isBento ? ['top', 'side'] : ['top', 'side', 'base_board'];
    const messagesByPosition = new Map((analysis?.cake_messages || []).map(message => [message.position, message]));
    visibleMessagePositions.forEach((position) => {
        const existingMessage = messagesByPosition.get(position as 'top' | 'side' | 'base_board');
        const positionLabel = getMessagePositionLabel(position as keyof typeof MESSAGE_POSITION_LABELS);

        if (existingMessage && cleanText(existingMessage.text)) {
            addSuggestion(suggestions, `change the ${quotePromptValue(existingMessage.text)} ${positionLabel} message to ...`);
            addSuggestion(suggestions, `change the ${positionLabel} message color to ...`);
            addSuggestion(suggestions, `remove the ${positionLabel} message`);
            return;
        }

        const location = position === 'base_board' ? 'the base board' : `the cake ${positionLabel}`;
        addSuggestion(suggestions, `add a message on ${location} saying "..."`);
    });

    const existingTopper = analysis?.main_toppers?.find(topper => cleanText(topper.description));
    if (existingTopper) {
        addSuggestion(suggestions, `change the ${quotePromptValue(existingTopper.description)} topper to ${getTopperReplacementSuggestion(existingTopper)}`);
        addSuggestion(suggestions, `remove the ${quotePromptValue(existingTopper.description)} topper`);

        if (canChangeTopperMaterial(existingTopper as EditableDecor)) {
            addSuggestion(suggestions, `change the ${quotePromptValue(existingTopper.description)} topper material to ...`);
        }

        if (canChangeDecorMultipleColors(existingTopper as EditableDecor)) {
            addSuggestion(suggestions, `change the colors of the ${quotePromptValue(existingTopper.description)} topper to ...`);
        } else if (canChangeDecorColor(existingTopper as EditableDecor)) {
            addSuggestion(suggestions, `change the color of the ${quotePromptValue(existingTopper.description)} topper to ...`);
        }

        if (canReplaceDecorImage(existingTopper as EditableDecor)) {
            addSuggestion(suggestions, `replace the image of the ${quotePromptValue(existingTopper.description)} topper`);
        }
    }

    const existingSupportElement = analysis?.support_elements?.find(element => cleanText(element.description));
    if (existingSupportElement) {
        addSuggestion(suggestions, `remove the ${quotePromptValue(existingSupportElement.description)} support decoration`);

        if (canChangeSupportMaterial(existingSupportElement as EditableDecor)) {
            addSuggestion(suggestions, `change the ${quotePromptValue(existingSupportElement.description)} support decoration material to ...`);
        }

        if (canChangeDecorMultipleColors(existingSupportElement as EditableDecor)) {
            addSuggestion(suggestions, `change the colors of the ${quotePromptValue(existingSupportElement.description)} support decoration to ...`);
        } else if (canChangeDecorColor(existingSupportElement as EditableDecor)) {
            addSuggestion(suggestions, `change the color of the ${quotePromptValue(existingSupportElement.description)} support decoration to ...`);
        }

        if (canReplaceDecorImage(existingSupportElement as EditableDecor)) {
            addSuggestion(suggestions, `replace the image of the ${quotePromptValue(existingSupportElement.description)} support decoration`);
        }
    }

    return Array.from(new Set(suggestions)).slice(0, 32);
};