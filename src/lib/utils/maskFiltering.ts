import { decodeRLE } from './segmentation';

/**
 * Calculate the area (number of pixels) of a mask
 */
function calculateMaskArea(mask: string, height: number, width: number): number {
    try {
        const decoded = decodeRLE(mask, height, width);
        return decoded.reduce((sum, val) => sum + val, 0);
    } catch (error) {
        console.warn('Error calculating mask area:', error);
        return 0;
    }
}

/**
 * Filter segmentation items to keep only the most significant masks
 * Uses confidence scores instead of area to avoid decoding issues
 */
export function filterSignificantMasks(
    items: Array<{ mask: any; label: string; confidence: number }>,
    options: {
        maxMasks?: number;        // Maximum number of masks to keep (default: 10)
        minConfidence?: number;   // Minimum confidence threshold (default: 0.5)
        sortByConfidence?: boolean; // Sort by confidence descending (default: true)
    } = {}
): Array<{ mask: any; label: string; confidence: number }> {
    const {
        maxMasks = 10,
        minConfidence = 0.5,
        sortByConfidence = true
    } = options;

    console.log(`🎯 Filtering ${items.length} masks...`);
    console.log(`📊 Min confidence threshold: ${minConfidence}`);

    // Filter by confidence
    let filtered = items.filter(item => item.confidence >= minConfidence);
    console.log(`✂️ After confidence filter: ${filtered.length} masks (removed ${items.length - filtered.length} low confidence masks)`);

    // Sort by confidence (descending) if requested
    if (sortByConfidence) {
        filtered.sort((a, b) => b.confidence - a.confidence);
    }

    // Limit to max number of masks
    if (filtered.length > maxMasks) {
        console.log(`🔻 Limiting to top ${maxMasks} highest confidence masks`);
        filtered = filtered.slice(0, maxMasks);
    }

    console.log(`✅ Final filtered masks: ${filtered.length}`);
    filtered.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.label}: confidence ${item.confidence.toFixed(3)}`);
    });

    return filtered;
}

/**
 * Filter masks to keep only cake-relevant components
 * Uses confidence scores for filtering
 */
export function filterCakeComponents(
    items: Array<{ mask: any; label: string; confidence: number }>
): Array<{ mask: any; label: string; confidence: number }> {
    // For cake images, keep high-confidence masks
    return filterSignificantMasks(items, {
        maxMasks: 3,           // Keep only top 3 masks to avoid full coverage
        minConfidence: 0.7,    // At least 70% confidence
        sortByConfidence: true // Sort by confidence
    });
}
