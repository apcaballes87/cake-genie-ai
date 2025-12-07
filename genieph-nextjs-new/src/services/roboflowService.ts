/**
 * Roboflow Serverless + Florence-2 Integration
 * 
 * This service handles object detection using Roboflow's serverless API
 * with the Florence-2 vision model from Microsoft.
 */

import { BoundingBox } from '@/types';
import { ROBOFLOW_CONFIG, FEATURE_FLAGS } from '@/config/features';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Bounding box detection from Roboflow (coordinates from top-left origin)
 */
export interface RoboflowBbox {
    x: number;         // Center X (pixels from top-left)
    y: number;         // Center Y (pixels from top-left)
    width: number;     // Bbox width in pixels
    height: number;    // Bbox height in pixels
    class: string;     // Detected class name
    confidence: number; // Detection confidence (0.0-1.0)
}

/**
 * Roboflow Serverless API response
 */
export interface RoboflowResponse {
    outputs: {
        bboxes: RoboflowBbox[];
    };
}

/**
 * Coordinates with bounding box in app coordinate system
 */
export interface AppCoordinates {
    x: number;   // Center X (app coordinates: center origin)
    y: number;   // Center Y (app coordinates: center origin)
    bbox: BoundingBox;  // Bounding box (app coordinates)
}

// ============================================================================
// API Integration
// ============================================================================

/**
 * Detect objects using Roboflow Serverless + Florence-2
 * 
 * @param base64Image - Base64 encoded image data
 * @param mimeType - Image MIME type (e.g., 'image/jpeg')
 * @returns Array of detected bounding boxes
 * @throws Error if API call fails or configuration is missing
 */
export async function detectObjectsWithRoboflow(
    base64Image: string,
    mimeType: string,
    classes: string[]
): Promise<RoboflowBbox[]> {
    const { apiKey, workspace, workflowId } = ROBOFLOW_CONFIG;

    if (!apiKey || !workspace) {
        throw new Error('Roboflow not configured: missing API key or workspace');
    }

    if (!workflowId) {
        throw new Error('Roboflow workflow ID not configured. Set VITE_ROBOFLOW_MODEL env variable.');
    }

    // Correct V2 API endpoint format
    const url = `https://serverless.roboflow.com/${workspace}/workflows/${workflowId}`;

    // Convert base64 to data URL for Roboflow
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    if (FEATURE_FLAGS.DEBUG_ROBOFLOW) {
        console.log('🤖 Calling Roboflow Serverless API...');
        console.log(`   Workspace: ${workspace}`);
        console.log(`   Workflow ID: ${workflowId}`);
        console.log(`   Image size: ${(base64Image.length / 1024).toFixed(2)} KB`);
        console.log(`   Classes: ${classes.length} items`);
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                inputs: {
                    image: imageDataUrl,
                    classes: classes
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Roboflow API error (${response.status}): ${errorText}`);
        }

        const result: RoboflowResponse = await response.json();
        const bboxes = result.outputs?.bboxes || [];

        if (FEATURE_FLAGS.DEBUG_ROBOFLOW) {
            console.log(`✅ Roboflow detected ${bboxes.length} objects`);
            bboxes.forEach((bbox, i) => {
                console.log(`   ${i + 1}. ${bbox.class} (confidence: ${(bbox.confidence * 100).toFixed(1)}%)`);
            });
        }

        // Filter by confidence threshold
        const filtered = bboxes.filter(
            bbox => bbox.confidence >= FEATURE_FLAGS.ROBOFLOW_CONFIDENCE_THRESHOLD
        );

        if (FEATURE_FLAGS.DEBUG_ROBOFLOW && filtered.length < bboxes.length) {
            console.log(`   Filtered ${bboxes.length - filtered.length} low-confidence detections`);
        }

        return filtered;

    } catch (error) {
        console.error('❌ Roboflow API call failed:', error);
        throw error;
    }
}

// ============================================================================
// Coordinate Transformation
// ============================================================================

/**
 * Convert Roboflow bbox coordinates to app coordinate system
 * 
 * Roboflow uses top-left origin (0,0 at top-left corner)
 * App uses center origin (0,0 at image center, Y-axis inverted)
 * 
 * @param rfBbox - Roboflow bounding box detection
 * @param imageWidth - Original image width in pixels
 * @param imageHeight - Original image height in pixels
 * @returns Coordinates and bbox in app coordinate system
 */
export function roboflowBboxToAppCoordinates(
    rfBbox: RoboflowBbox,
    imageWidth: number,
    imageHeight: number
): AppCoordinates {
    // 1. Calculate center point in app coordinates
    //    Roboflow x,y is center of bbox from top-left
    //    App x,y is center from image center
    const centerX = rfBbox.x - (imageWidth / 2);
    const centerY = (imageHeight / 2) - rfBbox.y;  // Y-axis is inverted

    // 2. Calculate top-left corner of bbox in app coordinates
    const bboxTopLeftX = (rfBbox.x - rfBbox.width / 2) - (imageWidth / 2);
    const bboxTopLeftY = (imageHeight / 2) - (rfBbox.y - rfBbox.height / 2);

    if (FEATURE_FLAGS.DEBUG_ROBOFLOW) {
        console.log(`   Transform "${rfBbox.class}": ` +
            `Roboflow(${rfBbox.x}, ${rfBbox.y}) → ` +
            `App(${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
    }

    return {
        x: centerX,
        y: centerY,
        bbox: {
            x: bboxTopLeftX,
            y: bboxTopLeftY,
            width: rfBbox.width,
            height: rfBbox.height,
            confidence: rfBbox.confidence
        }
    };
}

/**
 * Validate coordinates are within image bounds
 */
export function validateCoordinates(
    x: number,
    y: number,
    imageWidth: number,
    imageHeight: number
): boolean {
    const maxX = imageWidth / 2;
    const maxY = imageHeight / 2;

    return (
        x >= -maxX && x <= maxX &&
        y >= -maxY && y <= maxY
    );
}

// ============================================================================
// Class Mapping
// ============================================================================

/**
 * Map Florence-2 detected classes to app element types
 * 
 * @param className - Class name from Roboflow detection
 * @returns App element type or null if no mapping found
 */
export function mapRoboflowClassToAppType(className: string): string | null {
    const normalized = className.toLowerCase().trim();

    const classMap: Record<string, string> = {
        'cake topper': 'cake_topper',
        'character': 'character',
        'flower': 'flowers',
        'text': 'gumpaste_letters',
        'decoration': 'edible_3d_ordinary',
        'toy': 'toy',
        'candle': 'candle',
        'sprinkles': 'sprinkles'
    };

    return classMap[normalized] || null;
}

/**
 * Find best matching detection for a feature
 * 
 * @param featureType - Type of feature from Gemini analysis
 * @param featureDescription - Description from Gemini analysis
 * @param detections - Array of Roboflow detections
 * @returns Best matching detection or null
 */
export function findMatchingDetection(
    featureType: string,
    featureDescription: string,
    detections: RoboflowBbox[]
): RoboflowBbox | null {
    if (detections.length === 0) return null;

    // Strategy 1: Exact type match
    const typeMatches = detections.filter(d => {
        const mappedType = mapRoboflowClassToAppType(d.class);
        return mappedType === featureType;
    });

    if (typeMatches.length === 1) {
        return typeMatches[0];
    }

    // Strategy 2: Multiple matches - pick highest confidence
    if (typeMatches.length > 1) {
        return typeMatches.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
        );
    }

    // Strategy 3: Fuzzy match on description
    const descWords = featureDescription.toLowerCase().split(' ');
    for (const detection of detections) {
        const className = detection.class.toLowerCase();
        if (descWords.some(word => className.includes(word) || word.includes(className))) {
            return detection;
        }
    }

    return null;
}
