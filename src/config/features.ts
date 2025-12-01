/**
 * Feature flags for gradual rollout of new features
 */

export const FEATURE_FLAGS = {
    /**
     * Use Roboflow for coordinate detection instead of Gemini
     * Default: false (use Gemini)
     */
    USE_ROBOFLOW_COORDINATES: import.meta.env.VITE_USE_ROBOFLOW === 'true',

    /**
     * Minimum confidence threshold for Roboflow detections
     * Range: 0.0 to 1.0
     */
    ROBOFLOW_CONFIDENCE_THRESHOLD: parseFloat(
        import.meta.env.VITE_ROBOFLOW_CONFIDENCE || '0.3'
    ),

    /**
     * Fallback to Gemini if Roboflow fails
     * Default: true (safe fallback)
     */
    FALLBACK_TO_GEMINI: import.meta.env.VITE_ROBOFLOW_FALLBACK !== 'false',

    /**
     * Enable debug logging for Roboflow
     */
    DEBUG_ROBOFLOW: false,
} as const;

/**
 * Roboflow configuration
 */
export const ROBOFLOW_CONFIG = {
    apiKey: import.meta.env.VITE_ROBOFLOW_API_KEY || '',
    workspace: import.meta.env.VITE_ROBOFLOW_WORKSPACE || '',
    workflowId: import.meta.env.VITE_ROBOFLOW_WORKFLOW_ID || import.meta.env.VITE_ROBOFLOW_MODEL || '',
    version: import.meta.env.VITE_ROBOFLOW_VERSION || '1',
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
