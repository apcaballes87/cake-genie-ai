import { createClient } from '@/lib/supabase/client';

export async function getDynamicTypeEnums(supabase: any) {
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_type, category, sub_item_type')
        .eq('is_active', true)
        .not('item_type', 'is', null);

    if (error || !data) {
        console.warn('Failed to fetch dynamic enums from database, using fallbacks');
        return {
            mainTopperTypes: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo_top', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'],
            supportElementTypes: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'macarons', 'meringue', 'gumpaste_bundle', 'candy', 'gumpaste_panel', 'icing_decorations', 'gumpaste_creations'],
            subtypesByType: {} as Record<string, string[]>
        };
    }

    const mainTopperTypes = new Set<string>();
    const supportElementTypes = new Set<string>();
    const subtypesByType: Record<string, string[]> = {};

    data.forEach((rule: any) => {
        if (rule.item_type) {
            if (rule.category === 'main_topper') {
                mainTopperTypes.add(rule.item_type);
            } else if (rule.category === 'support_element') {
                supportElementTypes.add(rule.item_type);
            }

            if (rule.sub_item_type) {
                if (!subtypesByType[rule.item_type]) {
                    subtypesByType[rule.item_type] = [];
                }
                if (!subtypesByType[rule.item_type].includes(rule.sub_item_type)) {
                    subtypesByType[rule.item_type].push(rule.sub_item_type);
                }
            }
        }
    });

    const mainTopperPriority = [
        'candle', 'edible_photo_top', 'printout', 'cardstock', 'edible_2d_shapes',
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
