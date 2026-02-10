
/**
 * Helper to convert hex string to RGB object
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

/**
 * The 10 available icing color buckets that correspond to actual image sets.
 * Hex values are mid-tone representatives for accurate RGB distance matching.
 */
export const AVAILABLE_ICING_COLORS = [
    { name: 'black', keywords: ['black', 'dark'], hex: '#1A1A1A' },
    { name: 'white', keywords: ['white', 'light white', 'gray', 'grey', 'cream', 'silver'], hex: '#E2E8F0' },
    { name: 'blue', keywords: ['blue', 'cyan', 'sky', 'baby blue', 'teal', 'aqua', 'turquoise'], hex: '#60A5FA' },
    { name: 'red', keywords: ['red', 'maroon', 'crimson', 'scarlet'], hex: '#EF4444' },
    { name: 'purple', keywords: ['purple', 'violet', 'lavender', 'lilac', 'mauve'], hex: '#8B5CF6' },
    { name: 'green', keywords: ['green', 'mint', 'lime', 'emerald', 'sage', 'olive'], hex: '#22C55E' },
    { name: 'yellow', keywords: ['yellow', 'gold', 'lemon', 'canary'], hex: '#FACC15' },
    { name: 'orange', keywords: ['orange', 'tangerine', 'peach', 'coral', 'salmon'], hex: '#F97316' },
    { name: 'brown', keywords: ['brown', 'chocolate', 'tan', 'mocha', 'coffee', 'caramel'], hex: '#92400E' },
    { name: 'pink', keywords: ['pink', 'rose', 'magenta', 'fuchsia', 'blush'], hex: '#EC4899' },
];

/**
 * Maps any input color (name or hex) to one of the 10 available icing color buckets.
 * Uses exact mapping, keyword matching, and RGB distance fallback.
 */
export const findClosestColor = (color: string, availableColors = AVAILABLE_ICING_COLORS): string => {
    if (!color) return 'white';

    // Expanded direct map covering common AI-generated hex values and their pastel/light variants
    const DIRECT_COLOR_MAP: Record<string, string> = {
        // Reds
        '#EF4444': 'red', '#FCA5A5': 'red', '#DC2626': 'red', '#B91C1C': 'red',
        '#FF0000': 'red', '#FF6B6B': 'red', '#E53E3E': 'red', '#C53030': 'red',
        '#8B0000': 'red', // Dark Red
        // Oranges
        '#F97316': 'orange', '#FFA500': 'orange', '#FB923C': 'orange', '#EA580C': 'orange',
        '#FF8C00': 'orange', '#ED8936': 'orange',
        // Yellows
        '#EAB308': 'yellow', '#FFFF00': 'yellow', '#FDE047': 'yellow', '#FACC15': 'yellow',
        '#FFD700': 'yellow', '#F6E05E': 'yellow', '#FBBF24': 'yellow',
        // Greens
        '#16A34A': 'green', '#4ADE80': 'green', '#14B8A6': 'green', '#22C55E': 'green',
        '#00FF00': 'green', '#10B981': 'green', '#34D399': 'green', '#059669': 'green',
        '#48BB78': 'green', '#68D391': 'green', '#90EE90': 'green',
        // Blues (including light/sky/baby blue)
        '#3B82F6': 'blue', '#93C5FD': 'blue', '#60A5FA': 'blue', '#2563EB': 'blue',
        '#0000FF': 'blue', '#1D4ED8': 'blue', '#BFDBFE': 'blue', '#DBEAFE': 'blue',
        '#87CEEB': 'blue', '#87CEFA': 'blue', '#ADD8E6': 'blue', '#B0E0E6': 'blue',
        '#00BFFF': 'blue', '#1E90FF': 'blue', '#6495ED': 'blue', '#4169E1': 'blue',
        '#00CED1': 'blue', '#40E0D0': 'blue', '#7DD3FC': 'blue', '#38BDF8': 'blue',
        '#0EA5E9': 'blue', '#0284C7': 'blue', '#89CFF0': 'blue', '#00B4D8': 'blue',
        '#00008B': 'blue', // Dark Blue
        // Purples
        '#8B5CF6': 'purple', '#C4B5FD': 'purple', '#A855F7': 'purple', '#7C3AED': 'purple',
        '#800080': 'purple', '#9333EA': 'purple', '#D8B4FE': 'purple', '#6B21A8': 'purple',
        '#9F7AEA': 'purple', '#B794F4': 'purple', '#E9D5FF': 'purple',
        '#E6E6FA': 'purple', // Lavender
        // Pinks
        '#EC4899': 'pink', '#FBCFE8': 'pink', '#F472B6': 'pink', '#DB2777': 'pink',
        '#FFC0CB': 'pink', '#FF69B4': 'pink', '#FFB6C1': 'pink', '#FF1493': 'pink',
        '#FDA4AF': 'pink', '#FB7185': 'pink', '#F9A8D4': 'pink', '#FF77A9': 'pink',
        // Browns
        '#78350F': 'brown', '#B45309': 'brown', '#92400E': 'brown', '#8B4513': 'brown',
        '#A0522D': 'brown', '#D2691E': 'brown', '#CD853F': 'brown', '#DEB887': 'brown',
        '#8B6914': 'brown', '#795548': 'brown',
        // Whites / Grays / Creams
        '#64748B': 'white', '#FFFFFF': 'white', '#F8F8FF': 'white', '#F5F5F5': 'white',
        '#FAFAFA': 'white', '#E2E8F0': 'white', '#CBD5E1': 'white', '#F1F5F9': 'white',
        '#FFFDD0': 'white', '#FFFAF0': 'white', '#FFF8DC': 'white', '#FFFFF0': 'white',
        '#C0C0C0': 'white', '#D3D3D3': 'white', '#A9A9A9': 'white', '#808080': 'white',
        // Blacks
        '#000000': 'black', '#1A1A1A': 'black', '#333333': 'black', '#1E293B': 'black',
        '#0F172A': 'black', '#111827': 'black',
    };

    const normalizedColor = color.toUpperCase();
    if (DIRECT_COLOR_MAP[normalizedColor]) return DIRECT_COLOR_MAP[normalizedColor];

    const colorLower = color.toLowerCase().trim();
    for (const colorOption of availableColors) {
        const sortedKeywords = [...colorOption.keywords].sort((a, b) => b.length - a.length);
        for (const keyword of sortedKeywords) {
            if (colorLower.includes(keyword)) return colorOption.name;
        }
    }

    if (colorLower.startsWith('#')) {
        const inputRgb = hexToRgb(colorLower);
        if (inputRgb) {
            let closestColor = availableColors[0].name;
            let minDistance = Infinity;
            for (const colorOption of availableColors) {
                const optionRgb = hexToRgb(colorOption.hex);
                if (optionRgb) {
                    const distance = Math.sqrt(
                        Math.pow(inputRgb.r - optionRgb.r, 2) +
                        Math.pow(inputRgb.g - optionRgb.g, 2) +
                        Math.pow(inputRgb.b - optionRgb.b, 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestColor = colorOption.name;
                    }
                }
            }
            return closestColor;
        }
    }
    return 'white';
};
