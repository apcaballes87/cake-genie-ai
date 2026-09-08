import type { HybridAnalysisResult } from '@/types';

/**
 * Check if analysis result has bounding box data from Roboflow/Florence-2
 * @param analysisResult - The analysis result to check
 * @returns true if bbox data exists, false otherwise
 */
export function hasBoundingBoxData(analysisResult: HybridAnalysisResult): boolean {
    // Check for explicit cake measurement lines, with a legacy bbox fallback.
    const hasCakeMeasurements = Boolean(
        analysisResult.cake_measurements?.diameter
        && analysisResult.cake_measurements.height
        && analysisResult.cake_measurements.diameter.start
        && analysisResult.cake_measurements.diameter.end
        && analysisResult.cake_measurements.height.start
        && analysisResult.cake_measurements.height.end,
    );
    const hasLegacyCakeBbox = Boolean(
        analysisResult.cake_bbox
        && analysisResult.cake_bbox.width > 0
        && analysisResult.cake_bbox.height > 0,
    );

    // Fresh line-mode analyses use size_line instead of priced-element bboxes.
    const hasToppersWithGeometry = analysisResult.main_toppers?.some(topper =>
        Boolean(topper.size_line)
        || Boolean(topper.bbox && topper.bbox.width > 0 && topper.bbox.height > 0),
    );

    const hasSupportWithGeometry = analysisResult.support_elements?.some(element =>
        Boolean(element.size_line)
        || Boolean(element.bbox && element.bbox.width > 0 && element.bbox.height > 0),
    );

    // Check if any messages have bbox data
    const hasMessagesWithBbox = analysisResult.cake_messages?.some(message =>
        message.bbox && message.bbox.width > 0 && message.bbox.height > 0,
    );

    return !!(hasCakeMeasurements || hasLegacyCakeBbox || hasToppersWithGeometry || hasSupportWithGeometry || hasMessagesWithBbox);
}

/**
 * Check if coordinate enrichment is needed
 * (either no coordinates at all, or no bbox data)
 */
export function needsCoordinateEnrichment(analysisResult: HybridAnalysisResult): boolean {
    const usesLineGeometry = analysisResult.analysis_size_schema === 'line_ratio_v1';

    if (usesLineGeometry) return false;

    // Check if any elements are missing usable geometry. Fresh analyses use
    // normalized size lines; legacy analyses may use bboxes or x/y values.
    const hasUncoordinatedToppers = analysisResult.main_toppers?.some(topper =>
        !topper.size_line
        && !topper.bbox
        && (topper.x === undefined || topper.y === undefined),
    );

    const hasUncoordinatedSupport = analysisResult.support_elements?.some(element =>
        !element.size_line
        && !element.bbox
        && (element.x === undefined || element.y === undefined),
    );

    const hasUncoordinatedMessages = analysisResult.cake_messages?.some(message =>
        !message.bbox
        && (message.x === undefined || message.y === undefined),
    );

    // Needs enrichment if missing coordinates OR missing bbox data
    return hasUncoordinatedToppers || hasUncoordinatedSupport || hasUncoordinatedMessages || !hasBoundingBoxData(analysisResult);
}
