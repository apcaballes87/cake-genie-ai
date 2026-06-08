import { STORAGE_BASE_URL, STORAGE_BUCKETS } from '@/constants';
import { findClosestColor } from '@/utils/colorUtils';
import type { IcingDesignUI } from '@/types';

export type IcingImageType =
    | 'top'
    | 'side'
    | 'drip'
    | 'borderTop'
    | 'borderBase'
    | 'gumpasteBaseBoard';

const ICING_TOOLBAR_FOLDER = 'icing_toolbar_colors';

const ICING_IMAGE_BASE_URL = `${STORAGE_BASE_URL}/${STORAGE_BUCKETS.cakegenie}/${ICING_TOOLBAR_FOLDER}/`;

const DEFAULT_FILES: Record<IcingImageType, { prefix: string; defaultFile: string }> = {
    top: { prefix: 'icing', defaultFile: 'icing_white.webp' },
    side: { prefix: 'icing', defaultFile: 'icing_white.webp' },
    drip: { prefix: 'drip', defaultFile: 'drip_white.webp' },
    borderTop: { prefix: 'top', defaultFile: 'top_white.webp' },
    borderBase: { prefix: 'baseborder', defaultFile: 'baseborder_white.webp' },
    gumpasteBaseBoard: { prefix: 'baseboard', defaultFile: 'baseboardwhite.webp' },
};

const TOP_SPECIFIC = {
    prefix: 'topicing',
    defaultFile: 'topicing_white.webp',
};

const assertNever = (value: never): never => {
    throw new Error(`Unhandled icing image type: ${String(value)}`);
};

/**
 * Build the public URL for an icing-toolbar swatch used by the customizing
 * page (toolbar icons, the body / top / side color pickers, and the sidebar
 * summary chips). Centralized here so the host, prefix conventions, and
 * default-fallback filenames live in exactly one place.
 *
 * `baseboard` is the only prefix that does NOT use the `_<bucket>` separator
 * (the canonical filename pattern is `baseboard<bucket>.webp`); every other
 * prefix uses `<prefix>_<bucket>.webp`.
 */
export const getIcingImage = (
    icingDesign: IcingDesignUI,
    type: IcingImageType,
    isTopSpecific = false,
): string => {
    const sideColor = icingDesign.colors?.side;
    const topColor = icingDesign.colors?.top;
    const color = (() => {
        switch (type) {
            case 'top':
                return topColor;
            case 'side':
                return sideColor;
            case 'drip':
                return sideColor ?? topColor;
            case 'borderTop':
                return topColor ?? sideColor;
            case 'borderBase':
                return sideColor ?? topColor;
            case 'gumpasteBaseBoard':
                return icingDesign.colors?.gumpasteBaseBoardColor;
            default:
                return assertNever(type);
        }
    })();

    if (isTopSpecific && type === 'top') {
        if (!color) return ICING_IMAGE_BASE_URL + TOP_SPECIFIC.defaultFile;
        return `${ICING_IMAGE_BASE_URL}${TOP_SPECIFIC.prefix}_${findClosestColor(color)}.webp`;
    }

    const { prefix, defaultFile } = DEFAULT_FILES[type];
    if (!color) return ICING_IMAGE_BASE_URL + defaultFile;

    const separator = prefix === 'baseboard' ? '' : '_';
    return `${ICING_IMAGE_BASE_URL}${prefix}${separator}${findClosestColor(color)}.webp`;
};
