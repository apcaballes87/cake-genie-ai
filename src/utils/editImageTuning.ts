import type { CompressionOptions } from '@/lib/utils/imageOptimization';
import type { BoundingBox, MainTopperUI, SupportElementUI } from '@/types';

type EditableDecor = MainTopperUI | SupportElementUI;

const TARGETED_DECOR_KEYWORDS = [
    'main topper',
    'support element',
    'material conversion detail',
    'replace its image',
    're-sculpt',
    'printout',
];

const hasColorsChanged = (item: EditableDecor): boolean =>
    Boolean(
        item.original_colors &&
        item.colors &&
        JSON.stringify(item.original_colors) !== JSON.stringify(item.colors)
    );

const hasTargetedDecorEdit = (item: EditableDecor): boolean =>
    !item.isEnabled ||
    Boolean(item.replacementImage) ||
    Boolean(item.original_type && item.type !== item.original_type) ||
    Boolean(item.original_color && item.color && item.original_color !== item.color) ||
    hasColorsChanged(item);

const getReferencePoint = (x?: number, y?: number, bbox?: BoundingBox) => {
    if (bbox) {
        return {
            x: bbox.x + bbox.width / 2,
            y: bbox.y - bbox.height / 2,
        };
    }

    if (typeof x === 'number' || typeof y === 'number') {
        return {
            x: x ?? 0,
            y: y ?? 0,
        };
    }

    return null;
};

export const buildDecorLocalizationHint = (item: {
    x?: number;
    y?: number;
    bbox?: BoundingBox;
}): string | null => {
    const point = getReferencePoint(item.x, item.y, item.bbox);
    if (!point) return null;

    const horizontal = point.x < -90 ? 'left' : point.x > 90 ? 'right' : 'center';
    const vertical = point.y > 90 ? 'upper' : point.y < -90 ? 'lower' : 'middle';
    const region = vertical === 'middle' ? `${vertical}-${horizontal}` : `${vertical}-${horizontal}`;

    return `This target is in the ${region} area of the cake. Keep the edit tightly confined to that localized region and preserve nearby icing and neighboring decorations.`;
};

export const getEditImageCompressionOptions = ({
    prompt,
    mainToppers,
    supportElements,
}: {
    prompt: string;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
}): CompressionOptions => {
    const hasDecorEdits = [...mainToppers, ...supportElements].some(hasTargetedDecorEdit);
    const promptTargetsDecor = TARGETED_DECOR_KEYWORDS.some(keyword =>
        prompt.toLowerCase().includes(keyword)
    );

    if (hasDecorEdits || promptTargetsDecor) {
        return {
            maxSizeMB: 1.4,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            fileType: 'image/jpeg',
        };
    }

    return {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: 'image/jpeg',
    };
};
