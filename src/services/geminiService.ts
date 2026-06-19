// services/geminiService.ts

import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '@/types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "@/constants";
import {
    detectObjectsWithRoboflow,
    roboflowBboxToAppCoordinates,
    findMatchingDetection
} from './roboflowService';
import { FEATURE_FLAGS, isRoboflowConfigured } from '@/config/features';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { getEditImageCompressionOptions } from '@/utils/editImageTuning';

// Cache the prompt for 10 minutes (Still used? Maybe optional if moved to server entirely)
// Keeping simple cache struct for now if deemed necessary for other things, but prompt fetching is now server-side
let promptCache: {
    prompt: string;
    timestamp: number;
} | null = null;

// Client-side fallback messages for AI rejections, keyed by `reason`. The analyze schema requires
// the model to return `message`, but if it ever omits it (or returns an unknown reason) we still
// want a human-readable string instead of "undefined". Mirrors STEP 1 of the analysis prompt.
const REJECTION_FALLBACK_MESSAGES: Record<string, string> = {
    not_a_cake: "This image doesn't appear to be a cake. Please upload a cake image.",
    multiple_cakes: "Please upload a single cake image. This image contains multiple cakes.",
    cake_slice_only: "We can't price cakes that are 1 slice only. Please upload a whole cake design image.",
    complex_sculpture: "This cake design is too complex for online pricing. Please contact us for a custom quote.",
    large_wedding_cake: "Large wedding cakes require in-store consultation for accurate pricing.",
};

const DEFAULT_REJECTION_MESSAGE =
    "This image can't be used for cake pricing. Please upload a clear photo of a single cake design.";

function resolveRejectionMessage(rejection: { reason?: string; message?: string } | undefined): string {
    const message = rejection?.message?.trim();
    if (message) return message;
    const reason = rejection?.reason;
    if (reason && REJECTION_FALLBACK_MESSAGES[reason]) return REJECTION_FALLBACK_MESSAGES[reason];
    return DEFAULT_REJECTION_MESSAGE;
}

const PROMPT_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Helper to encode array buffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Exported utility to read file as base64
export const fileToBase64 = async (file: File): Promise<{ mimeType: string; data: string }> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);
        return { mimeType: file.type, data: base64Data };
    } catch (error) {
        console.error("Error reading file:", error);
        throw new Error("Failed to read the image file.");
    }
};

function shouldSurfaceAiRouteMessage(error: unknown): error is Error {
    if (!(error instanceof Error)) return false;
    return /AI .*?(temporarily unavailable|not authorized)|quota|rate limit/i.test(error.message);
}

/**
 * Validates if the image is a cake using the server-side API
 */
export const validateCakeImage = async (
    base64ImageData: string,
    mimeType: string,
    useCase: 'default' | 'chat' = 'default'
): Promise<string> => {
    try {
        const response = await fetch('/api/ai/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64ImageData, mimeType, useCase })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Validation failed');
        }

        const result = await response.json();
        return result.classification;

    } catch (error) {
        console.error("Error validating cake image:", error);
        if (shouldSurfaceAiRouteMessage(error)) {
            throw error;
        }
        throw new Error("The AI failed to validate the image. Please try again.");
    }
};

/**
 * Analyzes cake features using the server-side API (Phase 1)
 */
export async function analyzeCakeFeaturesOnly(
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> {
    try {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64ImageData, mimeType })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Analysis failed');
        }

        const result = await response.json();

        // Check for AI rejection (except selfie, which we handle downstream in the context)
        if (result.rejection && result.rejection.isRejected && result.rejection.reason !== 'selfie') {
            throw new Error(`AI_REJECTION: ${resolveRejectionMessage(result.rejection)}`);
        }

        return result;

    } catch (error) {
        console.error("Error analyzing cake:", error);
        if (error instanceof Error && error.message.startsWith('AI_REJECTION:')) {
            throw error;
        }
        if (shouldSurfaceAiRouteMessage(error)) {
            throw error;
        }
        throw new Error("Failed to analyze cake image. Please try again.");
    }
}

export async function triggerStudioEditFromUpload(
    pHash: string,
    originalImage: { data: string; mimeType: string }
): Promise<boolean> {
    try {
        const response = await fetch('/api/ai/trigger-studio-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pHash,
                originalImage,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to trigger studio edit');
        }

        return true;
    } catch (error) {
        console.error('Error triggering studio edit from upload:', error);
        return false;
    }
}

/**
 * Enriches analysis with coordinates using Roboflow (Phase 2)
 * Orchestrates the calling of Roboflow service and merging results
 */
export async function enrichAnalysisWithCoordinates(
    base64ImageData: string,
    mimeType: string,
    featureAnalysis: HybridAnalysisResult
): Promise<HybridAnalysisResult> {
    // This function seems unused or legacy based on current usage of enrichAnalysisWithRoboflow
    // Redirecting to the Roboflow implementation which is the active one
    return enrichAnalysisWithRoboflow(base64ImageData, mimeType, featureAnalysis);
}

/**
 * Primary enrichment function using Roboflow via server proxy
 */
export async function enrichAnalysisWithRoboflow(
    base64ImageData: string,
    mimeType: string,
    featureAnalysis: HybridAnalysisResult
): Promise<HybridAnalysisResult> {
    // Check if Roboflow is enabled/configured (using Feature Flag only, config check is now server-side)
    if (!FEATURE_FLAGS.USE_ROBOFLOW_COORDINATES) {
        console.log("ℹ️ Roboflow disabled by feature flag");
        return featureAnalysis;
    }

    try {
        console.log("🚀 Starting Roboflow coordinate enrichment (via server)...");

        // 1. Get detections from server proxy
        // We pass ALL potential classes we care about based on our known types
        const knownClasses = [
            'cake topper', 'character', 'flower', 'text', 'decoration', 'toy', 'candle', 'sprinkles'
        ];

        const detections = await detectObjectsWithRoboflow(base64ImageData, mimeType, knownClasses);

        if (detections.length === 0) {
            console.log("⚠️ No objects detected by Roboflow");
            return featureAnalysis;
        }

        // 2. Clone the analysis to modify it
        const result = JSON.parse(JSON.stringify(featureAnalysis));
        let matchCount = 0;

        // Helper to find image dimensions from base64 (needed for coordinate math)
        // We do this client side to avoid sending full image back and forth just for dims
        const imageDims = await new Promise<{ width: number, height: number }>((resolve) => {
            const i = new Image();
            i.onload = () => resolve({ width: i.width, height: i.height });
            i.src = `data:${mimeType};base64,${base64ImageData}`;
        });

        // 3. Map main toppers
        if (result.main_toppers) {
            result.main_toppers = result.main_toppers.map((item: MainTopperUI) => {
                const match = findMatchingDetection(item.type, item.description, detections);
                if (match) {
                    const coords = roboflowBboxToAppCoordinates(match, imageDims.width, imageDims.height);
                    matchCount++;
                    return { ...item, ...coords }; // Update x, y, and bbox
                }
                return item;
            });
        }

        // 4. Map support elements
        if (result.support_elements) {
            result.support_elements = result.support_elements.map((item: SupportElementUI) => {
                const match = findMatchingDetection(item.type, item.description, detections);
                if (match) {
                    const coords = roboflowBboxToAppCoordinates(match, imageDims.width, imageDims.height);
                    matchCount++;
                    return { ...item, ...coords };
                }
                return item;
            });
        }

        console.log(`✅ Enriched ${matchCount} items with Roboflow coordinates`);
        return result;

    } catch (error) {
        console.error("❌ Roboflow enrichment failed:", error);
        // Fallback to original analysis if allowed
        if (FEATURE_FLAGS.FALLBACK_TO_GEMINI) {
            console.log("↩️ Falling back to original analysis (coordinates 0,0)");
            return featureAnalysis;
        }
        throw error;
    }
}

export interface ShareableTexts {
    title: string;
    description: string;
    altText: string;
}

/**
 * Generates SEO texts using server-side API
 */
export async function generateShareableTexts(
    analysisResult: HybridAnalysisResult,
    cakeInfo: CakeInfoUI,
    HEX_TO_COLOR_NAME_MAP: Record<string, string>,
    editedImageDataUri?: string | null
): Promise<ShareableTexts> {
    try {
        // We don't need HEX_TO_COLOR_NAME_MAP or editedImageDataUri for the AI generation
        // The server prompt handles the text generation based on the data
        const response = await fetch('/api/ai/generate-texts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analysisResult,
                cakeInfo
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate texts');
        }

        return await response.json();

    } catch (error) {
        console.error("Error generating texts:", error);
        // Fallback
        return {
            title: "Custom Cake Design",
            description: "A beautiful custom cake design.",
            altText: "Custom cake design"
        };
    }
}

/**
 * Edits cake image using server-side API
 */
export async function editCakeImage(
    prompt: string,
    originalImage: { data: string; mimeType: string; },
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    threeTierReferenceImage: { data: string; mimeType: string; } | null,
    systemInstruction: string,
    preferredModel?: 'gemini-2.5-flash-image' | 'gemini-3.1-flash-image-preview',
    traceId?: string,
    requestSource?: string,
): Promise<string> {
    try {
        const effectiveTraceId = traceId ?? `edit-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const startedAt = Date.now();

        console.log(`[AI TRACE ${effectiveTraceId}] editCakeImage:start`, {
            requestSource: requestSource ?? 'unknown',
            promptLength: prompt.length,
            originalMimeType: originalImage.mimeType,
            topperCount: mainToppers.length,
            supportElementCount: supportElements.length,
            hasThreeTierReferenceImage: Boolean(threeTierReferenceImage),
            preferredModel: preferredModel ?? 'gemini-3.1-flash-image-preview (default)',
        });

        // --- OPTIMIZATION START ---
        // Compress the image before sending to the API to reduce payload size and latency
        // The API only needs a visual reference (1024px is plenty), not the full 12MP upload

        const fullDataUri = `data:${originalImage.mimeType};base64,${originalImage.data}`;
        const imageBlob = dataURItoBlob(fullDataUri);
        const imageFile = new File([imageBlob], "input-image.png", { type: originalImage.mimeType });

        const compressionOptions = getEditImageCompressionOptions({
            prompt,
            mainToppers,
            supportElements,
        });

        const compressedFile = await compressImage(imageFile, compressionOptions);

        // Convert back to the format expected by the API ({ data, mimeType })
        // We use the local fileToBase64 helper or just read it here
        const compressedBase64Result = await fileToBase64(compressedFile);

        console.log(`🚀 Designing Image (${preferredModel ?? 'gemini-3.1-flash-image-preview'}): Compressed input from ${(imageFile.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        console.log(`[AI TRACE ${effectiveTraceId}] editCakeImage:compressed`, {
            requestSource: requestSource ?? 'unknown',
            originalBytes: imageFile.size,
            compressedBytes: compressedFile.size,
            maxSizeMB: compressionOptions.maxSizeMB,
            maxWidthOrHeight: compressionOptions.maxWidthOrHeight,
        });

        const response = await fetch('/api/ai/edit-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-ai-trace-id': effectiveTraceId,
                'x-ai-request-source': requestSource ?? 'unknown',
            },
            body: JSON.stringify({
                prompt,
                originalImage: compressedBase64Result,
                threeTierReferenceImage,
                systemInstruction, // We pass this through as it's dynamically constructed in the UI
                preferredModel,
            })
        });

        console.log(`[AI TRACE ${effectiveTraceId}] editCakeImage:response`, {
            requestSource: requestSource ?? 'unknown',
            status: response.status,
            ok: response.ok,
            durationMs: Date.now() - startedAt,
        });

        if (!response.ok) {
            // Safely read the raw body text first (avoid JSON parse on HTML errors e.g. 504 timeouts)
            const rawErrorBody = await response.text().catch(() => '');
            let errorData: { error?: string } = {};
            try {
                errorData = rawErrorBody ? JSON.parse(rawErrorBody) : {};
            } catch {
                // Body was not JSON (e.g. HTML timeout page)
            }
            console.error(`[AI TRACE ${effectiveTraceId}] editCakeImage:failed-response`, {
                requestSource: requestSource ?? 'unknown',
                status: response.status,
                error: errorData?.error,
                rawBodySnippet: rawErrorBody.slice(0, 500),
            });
            throw new Error(errorData?.error || `Image edit failed with status ${response.status}`);
        }

        const result = await response.json();
        console.log(`[AI TRACE ${effectiveTraceId}] editCakeImage:success`, {
            requestSource: requestSource ?? 'unknown',
            mimeType: result.mimeType,
            durationMs: Date.now() - startedAt,
        });

        // Return as data URI
        return `data:${result.mimeType};base64,${result.imageData}`;

    } catch (error) {
        console.error("Error editing image:", error);
        throw error; // Re-throw the specific error
    }
}

// Helper to strip prefix (if still needed by consumers)
editCakeImage.stripDataUriPrefix = (dataUri: string): string => {
    return dataUri.replace(/^data:image\/[a-z]+;base64,/, '');
};


// Export clearPromptCache for backward compatibility (it does nothing now as cache is server side mostly)
export function clearPromptCache() {
    promptCache = null;
}
