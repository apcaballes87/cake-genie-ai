/**
 * Feature flags for gradual rollout of new features
 */

export const FEATURE_FLAGS = {
    /**
     * Use Roboflow for coordinate detection instead of Gemini
     * Default: false (use Gemini)
     */
    USE_ROBOFLOW_COORDINATES: process.env.NEXT_PUBLIC_USE_ROBOFLOW === 'true',

    /**
     * Minimum confidence threshold for Roboflow detections
     * Range: 0.0 to 1.0
     */
    ROBOFLOW_CONFIDENCE_THRESHOLD: parseFloat(
        process.env.NEXT_PUBLIC_ROBOFLOW_CONFIDENCE || '0.3'
    ),

    /**
     * Fallback to Gemini if Roboflow fails
     * Default: true (safe fallback)
     */
    FALLBACK_TO_GEMINI: process.env.NEXT_PUBLIC_ROBOFLOW_FALLBACK !== 'false',

    /**
     * Enable debug logging for Roboflow
     */
    DEBUG_ROBOFLOW: false,

    /**
     * Use the new pricing validation system (v2)
     * - Validates AI output against pricingEnums.ts
     * - Logs structured errors for type mismatches
     * - Default: false (use legacy pricing, no validation)
     */
    USE_NEW_PRICING_SYSTEM: process.env.NEXT_PUBLIC_USE_NEW_PRICING === 'true',
} as const;

/**
 * Roboflow configuration
 */
export const ROBOFLOW_CONFIG = {
    apiKey: process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY || '',
    workspace: process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE || '',
    workflowId: process.env.NEXT_PUBLIC_ROBOFLOW_WORKFLOW_ID || process.env.NEXT_PUBLIC_ROBOFLOW_MODEL || '',
    version: process.env.NEXT_PUBLIC_ROBOFLOW_VERSION || '1',
} as const;

/**
 * Validate Roboflow configuration
 */
export function isRoboflowConfigured(): boolean {
    return !!(
        ROBOFLOW_CONFIG.apiKey &&
        ROBOFLOW_CONFIG.workspace
    );
}
