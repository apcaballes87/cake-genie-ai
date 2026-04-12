const TOY_LIKE_TYPES = ['toy', 'figurine', 'plastic_ball'] as const;

export const isToyLikeType = (type?: string | null): boolean =>
    Boolean(type && TOY_LIKE_TYPES.includes(type as typeof TOY_LIKE_TYPES[number]));

export const requestMentionsPrintoutConversion = (request: string): boolean => {
    const normalized = request.toLowerCase();

    return [
        'printout',
        'printed',
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
