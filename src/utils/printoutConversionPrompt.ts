import type { MainTopperUI } from '@/types';
import { buildDecorLocalizationHint } from '@/utils/editImageTuning';

const TOY_LIKE_TYPES = ['toy', 'figurine', 'plastic_ball'] as const;
const EDIBLE_3D_TOPPER_TYPES = ['edible_3d_complex', 'edible_3d_ordinary'] as const;

export const isToyLikeType = (type?: string | null): boolean =>
    Boolean(type && TOY_LIKE_TYPES.includes(type as typeof TOY_LIKE_TYPES[number]));

export const isEdible3DTopperType = (type?: string | null): boolean =>
    Boolean(type && EDIBLE_3D_TOPPER_TYPES.includes(type as typeof EDIBLE_3D_TOPPER_TYPES[number]));

export const requestMentionsPrintoutConversion = (request: string): boolean => {
    const normalized = request.toLowerCase();

    return [
        'printout',
        'printed',
        'cardboard',
        'paper cutout',
        'paper topper',
        '2d topper',
        'flat topper',
    ].some(keyword => normalized.includes(keyword));
};

export const buildToyToPrintoutInstruction = ({
    description,
    originalType,
}: {
    description?: string | null;
    originalType?: string | null;
}): string => {
    const subject = description?.trim() || 'the topper';
    const sourceLabel = originalType === 'plastic_ball'
        ? '3D plastic decorative ball'
        : originalType === 'figurine'
            ? '3D figurine'
            : '3D toy';

    return `completely remove the existing ${sourceLabel} for "${subject}" and replace it with a flat 2D printed paper cutout version of the same subject. Keep the same character or subject identity, approximate size, placement, and facing direction unless another instruction says otherwise. The replacement must visibly look like a thin photopaper printout topper with a slim stick or backing. Do NOT leave any molded plastic seams, rounded limbs, glossy plastic volume, or full 3D toy depth in the final image.`;
};

export const buildEdibleToPrintoutInstruction = ({
    description,
    originalType,
}: {
    description?: string | null;
    originalType?: string | null;
}): string => {
    const subject = description?.trim() || 'the topper';
    const sourceLabel = originalType === 'edible_3d_complex'
        ? 'complex 3D edible/gumpaste topper'
        : '3D edible/gumpaste topper';

    return `convert only the existing ${sourceLabel} identified as "${subject}" into a flat, cartoon-style printable cardboard cutout. Completely remove its edible 3D volume and replace it with a thin 2D printed-cardstock topper of the same subject. Render this 2D cardboard cutout with bright flat colors, clear black vector-style outlines, and a thick, solid white die-cut border around its entire silhouette, like printed cardstock. Preserve the subject's identity, recognizable silhouette, approximate size, placement, and facing direction. Insert it into the icing with a slim stick or backing and blend it into the realistic cake scene with natural contact and accurate cast shadows on the frosting. Do not change any other topper, message, icing, or cake decoration. Do NOT leave any 3D edible/gumpaste volume, molded texture, rounded sculpted form, or glossy 3D shading on this target.`;
};

export const getPrintoutConversionTargets = (
    request: string,
    mainToppers: MainTopperUI[],
): MainTopperUI[] => {
    if (!requestMentionsPrintoutConversion(request)) return [];

    return mainToppers.filter((topper) => {
        const sourceType = topper.original_type || topper.type;
        return topper.isEnabled
            && topper.type !== 'printout'
            && (isToyLikeType(sourceType) || isEdible3DTopperType(sourceType));
    });
};

export const buildPrintoutConversionDetail = (topper: MainTopperUI): string => {
    const sourceType = topper.original_type || topper.type;
    const instruction = isEdible3DTopperType(sourceType)
        ? buildEdibleToPrintoutInstruction({
            description: topper.description,
            originalType: sourceType,
        })
        : buildToyToPrintoutInstruction({
            description: topper.description,
            originalType: sourceType,
        });
    const localizationHint = buildDecorLocalizationHint(topper);

    return `${instruction}${localizationHint ? ` ${localizationHint}` : ''}`;
};
