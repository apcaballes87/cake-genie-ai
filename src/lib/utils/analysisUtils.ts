import type { HybridAnalysisResult } from '../../types';

/**
 * Check if analysis result has bounding box data from Roboflow/Florence-2
 * @param analysisResult - The analysis result to check
 * @returns true if bbox data exists, false otherwise
 */
export function hasBoundingBoxData(analysisResult: HybridAnalysisResult): boolean {
    // Check if any main toppers have bbox data
    const hasToppersWithBbox = analysisResult.main_toppers?.some(topper =>
        topper.bbox && topper.bbox.confidence > 0
    );

    // Check if any support elements have bbox data
    const hasSupportWithBbox = analysisResult.support_elements?.some(element =>
        element.bbox && element.bbox.confidence > 0
    );

    // Check if any messages have bbox data
    const hasMessagesWithBbox = analysisResult.cake_messages?.some(message =>
        message.bbox && message.bbox.confidence > 0
    );

    return !!(hasToppersWithBbox || hasSupportWithBbox || hasMessagesWithBbox);
}

/**
 * Check if coordinate enrichment is needed
 * (either no coordinates at all, or no bbox data)
 */
export function needsCoordinateEnrichment(analysisResult: HybridAnalysisResult): boolean {
    // Check if any elements are missing coordinates
    const hasUncoordinatedToppers = analysisResult.main_toppers?.some(topper =>
        topper.x === undefined || topper.y === undefined
    );

    const hasUncoordinatedSupport = analysisResult.support_elements?.some(element =>
        element.x === undefined || element.y === undefined
    );

    const hasUncoordinatedMessages = analysisResult.cake_messages?.some(message =>
        message.x === undefined || message.y === undefined
    );

    // Needs enrichment if missing coordinates OR missing bbox data
    return hasUncoordinatedToppers || hasUncoordinatedSupport || hasUncoordinatedMessages || !hasBoundingBoxData(analysisResult);
}
