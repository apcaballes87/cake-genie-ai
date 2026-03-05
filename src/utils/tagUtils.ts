import { findClosestColor } from './colorUtils';
import { HybridAnalysisResult } from '@/types';

const STOP_WORDS = new Set([
    'this', 'is', 'a', 'an', 'the', 'of', 'in', 'and', 'for', 'with', 'on', 'at', 'to', 'from', 'by',
    'cake', 'themed', 'perfect', 'special', 'occasion', 'detailed', 'hues', 'capture', 'happiness',
    'moment', 'tier', '1', '2', '3', 'features', 'out', 'any'
]);

/**
 * Extracts and generates a clean array of tags based on the cake analysis result,
 * SEO data, and keywords.
 *
 * @param analysisResult - The raw AI analysis JSON
 * @param keywords - The comma-separated keywords string
 * @param seoTitle - The generated or provided SEO title
 * @param altText - The generated or provided Alt Text
 * @returns Array of lowercase, deduplicated tag strings
 */
export function generateTagsForAnalysis(
    analysisResult: HybridAnalysisResult | null,
    keywords: string | null,
    seoTitle: string | null,
    altText: string | null
): string[] {
    const tags = new Set<string>();

    // 1. Keywords
    if (keywords) {
        keywords.split(',').forEach((kw: string) => {
            const clean = kw.trim().toLowerCase();
            if (clean && clean.length > 2) tags.add(clean);
        });
    }

    // 2. Icing Colors (from analysis_json)
    if (analysisResult?.icing_design?.colors) {
        const colorsObj = analysisResult.icing_design.colors;
        Object.values(colorsObj).forEach((colorHex) => {
            if (typeof colorHex === 'string') {
                const colorName = findClosestColor(colorHex);
                if (colorName && colorName !== 'white') { // Often 'white' is default, can keep or discard. Keeping it if explicitly resolved.
                    tags.add(colorName.toLowerCase());
                } else if (colorName === 'white') {
                    // We only add white if it was actually in the hex, but findClosestColor returns white as fallback. 
                    // Let's just add it, tags are cheap.
                    tags.add('white');
                }
            }
        });
    }

    // 3. Relevant tokens from Title and Alt Text
    const extractWords = (text: string | null) => {
        if (!text) return;
        const words = text.split(/[^a-zA-Z0-9_-]+/);
        words.forEach(w => {
            const clean = w.toLowerCase().trim();
            // Filter out short words, stop words, and pure numbers
            if (clean.length > 2 && !STOP_WORDS.has(clean) && Number.isNaN(Number(clean))) {
                tags.add(clean);
            }
        });
    };

    extractWords(seoTitle);
    extractWords(altText);

    return Array.from(tags);
}
