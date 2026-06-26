import { MAIN_TOPPER_TYPES, SUPPORT_ELEMENT_TYPES } from '@/constants/pricingEnums';

const ITEM_KEY_TYPE_ALIASES: Record<string, string> = {
    icing_brush_stroke: 'icing_brush_stroke',
    icing_doodle: 'icing_doodle',
    icing_doodle_intricate: 'icing_doodle',
    icing_minimalist_spread: 'icing_minimalist_spread',
    icing_palette_knife: 'icing_palette_knife',
    icing_palette_knife_intricate: 'icing_palette_knife',
    icing_splatter: 'icing_splatter',
    support_printout: 'support_printout',
};

export async function getDynamicTypeEnums(supabase: any) {
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_type, item_key, category, sub_item_type')
        .eq('is_active', true);

    if (error || !data) {
        console.warn('Failed to fetch dynamic enums from database, using fallbacks');
        return {
            mainTopperTypes: [...MAIN_TOPPER_TYPES],
            supportElementTypes: [...SUPPORT_ELEMENT_TYPES],
            subtypesByType: {} as Record<string, string[]>
        };
    }

    const mainTopperTypes = new Set<string>(MAIN_TOPPER_TYPES);
    const supportElementTypes = new Set<string>(SUPPORT_ELEMENT_TYPES);
    const subtypesByType: Record<string, string[]> = {};

    data.forEach((rule: any) => {
        const resolvedItemType = rule.item_type || ITEM_KEY_TYPE_ALIASES[rule.sub_item_type] || ITEM_KEY_TYPE_ALIASES[rule.item_key];
        if (resolvedItemType) {
            if (rule.category === 'main_topper') {
                mainTopperTypes.add(resolvedItemType);
            } else if (rule.category === 'support_element') {
                supportElementTypes.add(resolvedItemType);
            }

            if (rule.sub_item_type) {
                if (!subtypesByType[resolvedItemType]) {
                    subtypesByType[resolvedItemType] = [];
                }
                if (!subtypesByType[resolvedItemType].includes(rule.sub_item_type)) {
                    subtypesByType[resolvedItemType].push(rule.sub_item_type);
                }
            }
        }
    });

    const mainTopperPriority = [
        'candle', 'edible_photo_top', 'edible_logo_2d', 'printout', 'cardstock', 'edible_2d_shapes',
        'edible_flowers', 'edible_3d_ordinary', 'edible_3d_complex', 'figurine', 'toy',
        'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter',
        'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'
    ];

    const sortedMainToppers = Array.from(mainTopperTypes).sort((a, b) => {
        const aIndex = mainTopperPriority.indexOf(a);
        const bIndex = mainTopperPriority.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    return {
        mainTopperTypes: sortedMainToppers,
        supportElementTypes: Array.from(supportElementTypes),
        subtypesByType,
    };
}
