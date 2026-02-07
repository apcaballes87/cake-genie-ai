// services/geminiService.ts

import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '@/types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "@/constants";
import { createClient } from '@/lib/supabase/client';
import {
    detectObjectsWithRoboflow,
    roboflowBboxToAppCoordinates,
    findMatchingDetection
} from './roboflowService';
import { FEATURE_FLAGS, isRoboflowConfigured } from '@/config/features';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';

const supabase = createClient();

// Cache the prompt for 10 minutes (Still used? Maybe optional if moved to server entirely)
// Keeping simple cache struct for now if deemed necessary for other things, but prompt fetching is now server-side
let promptCache: {
    prompt: string;
    timestamp: number;
} | null = null;

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

/**
 * Validates if the image is a cake using the server-side API
 */
export const validateCakeImage = async (base64ImageData: string, mimeType: string): Promise<string> => {
    try {
        const response = await fetch('/api/ai/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64ImageData, mimeType })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Validation failed');
        }

        const result = await response.json();
        return result.classification;

    } catch (error) {
        console.error("Error validating cake image:", error);
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

        return await response.json();

    } catch (error) {
        console.error("Error analyzing cake:", error);
        throw new Error("Failed to analyze cake image. Please try again.");
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
            result.main_toppers = result.main_toppers.map((item: any) => {
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
            result.support_elements = result.support_elements.map((item: any) => {
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
): Promise<string> {
    try {
        // --- OPTIMIZATION START ---
        // Compress the image before sending to the API to reduce payload size and latency
        // The API only needs a visual reference (1024px is plenty), not the full 12MP upload

        const fullDataUri = `data:${originalImage.mimeType};base64,${originalImage.data}`;
        const imageBlob = dataURItoBlob(fullDataUri);
        const imageFile = new File([imageBlob], "input-image.png", { type: originalImage.mimeType });

        // Use the imported compressImage utility (target ~1MB or 1024px)
        const compressedFile = await compressImage(imageFile, {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
            fileType: 'image/jpeg' // JPEG is efficient for AI input
        });

        // Convert back to the format expected by the API ({ data, mimeType })
        // We use the local fileToBase64 helper or just read it here
        const compressedBase64Result = await fileToBase64(compressedFile);

        console.log(`🚀 Designing Image: Compressed input from ${(imageFile.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

        const response = await fetch('/api/ai/edit-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                originalImage: compressedBase64Result,
                threeTierReferenceImage,
                systemInstruction // We pass this through as it's dynamically constructed in the UI
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to edit image');
        }

        const result = await response.json();

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