'use client';
import React from 'react';
import type { HybridAnalysisResult, BoundingBox } from '@/types';

type AnyBoundingBox = BoundingBox | { x: number; y: number; width: number; height: number };

interface BoundingBoxOverlayProps {
    analysisResult: HybridAnalysisResult;
    /** Rendered image dimensions, before any crop is clipped by the hero frame. */
    containerWidth: number;
    containerHeight: number;
    imageWidth: number;
    imageHeight: number;
    /** Rendered image origin relative to the hero frame. May be negative when cropped or scrolled. */
    offsetX?: number;
    offsetY?: number;
    /** When true, bbox coordinates are raw pixel values with top-left origin (Gemini). When false, center-origin app coordinates (legacy). */
    useTopLeftOrigin?: boolean;
}

/**
 * Color palette for different element types
 */
const COLORS = {
    main_topper: '#10B981',      // Green
    support_element: '#3B82F6',  // Blue
    cake_message: '#F59E0B',     // Amber
    cake: '#22C55E',             // Distinct green for cake body
    default: '#8B5CF6'           // Purple
};

/**
 * Scale a raw-pixel bbox (top-left origin) to container display coordinates
 */
function rawPixelToDisplay(
    rawX: number,
    rawY: number,
    rawWidth: number,
    rawHeight: number,
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
): { left: number; top: number; width: number; height: number } {
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    return {
        left: rawX * scaleX,
        top: rawY * scaleY,
        width: rawWidth * scaleX,
        height: rawHeight * scaleY,
    };
}

/**
 * Convert legacy center-origin app coordinates to display pixels
 */
function appCoordinatesToDisplay(
    appX: number,
    appY: number,
    appWidth: number,
    appHeight: number,
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
): { left: number; top: number; width: number; height: number } {
    const imgX = appX + (imageWidth / 2);
    const imgY = (imageHeight / 2) - appY;
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    return {
        left: imgX * scaleX,
        top: imgY * scaleY,
        width: appWidth * scaleX,
        height: appHeight * scaleY,
    };
}

/**
 * Renders bounding boxes for detected elements and the cake body
 */
export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
    analysisResult,
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
    offsetX = 0,
    offsetY = 0,
    useTopLeftOrigin = false,
}) => {
    const boxes: Array<{
        left: number;
        top: number;
        width: number;
        height: number;
        label: string;
        color: string;
        type: string;
        dashed?: boolean;
        confidence?: number;
    }> = [];
    const applyImageOffset = (display: { left: number; top: number; width: number; height: number }) => ({
        ...display,
        left: display.left + offsetX,
        top: display.top + offsetY,
    });

    // Cake body bounding box (always top-left origin from Gemini)
    if (analysisResult.cake_bbox) {
        const cb = analysisResult.cake_bbox;
        const display = applyImageOffset(rawPixelToDisplay(cb.x, cb.y, cb.width, cb.height, imageWidth, imageHeight, containerWidth, containerHeight));
        boxes.push({
            ...display,
            label: 'Cake',
            color: COLORS.cake,
            type: 'cake',
            dashed: true,
        });
    }

    // Element bounding boxes
    const collectElementBbox = (
        bbox: AnyBoundingBox | undefined,
        label: string,
        color: string,
        type: string,
    ) => {
        if (!bbox) return;
        if (useTopLeftOrigin) {
            // Gemini raw pixel coordinates (top-left origin)
            const display = applyImageOffset(rawPixelToDisplay(bbox.x, bbox.y, bbox.width, bbox.height, imageWidth, imageHeight, containerWidth, containerHeight));
            boxes.push({ ...display, label, color, type });
        } else {
            // Legacy center-origin app coordinates
            const display = applyImageOffset(appCoordinatesToDisplay(bbox.x, bbox.y, bbox.width, bbox.height, imageWidth, imageHeight, containerWidth, containerHeight));
            boxes.push({
                ...display,
                label,
                color,
                type,
                confidence: 'confidence' in bbox ? bbox.confidence : undefined,
            });
        }
    };

    analysisResult.main_toppers?.forEach((topper, index) => {
        collectElementBbox(
            topper.bbox,
            topper.description || `Topper ${index + 1}`,
            COLORS.main_topper,
            'topper',
        );
    });

    analysisResult.support_elements?.forEach((element, index) => {
        collectElementBbox(
            element.bbox,
            element.description || `Element ${index + 1}`,
            COLORS.support_element,
            'support',
        );
    });

    analysisResult.cake_messages?.forEach((message, index) => {
        collectElementBbox(
            message.bbox,
            message.text || `Message ${index + 1}`,
            COLORS.cake_message,
            'message',
        );
    });

    if (boxes.length === 0) {
        return null;
    }

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {boxes.map((box, index) => {
                const confidence = box.confidence != null ? Math.round(box.confidence * 100) : null;

                return (
                    <div
                        key={`${box.type}-${index}`}
                        className="absolute"
                        style={{
                            left: `${box.left}px`,
                            top: `${box.top}px`,
                            width: `${box.width}px`,
                            height: `${box.height}px`,
                            border: box.dashed
                                ? `2px dashed ${box.color}`
                                : `3px solid ${box.color}`,
                            borderRadius: '4px',
                            boxShadow: box.dashed
                                ? 'none'
                                : `0 0 0 2px rgba(255, 255, 255, 0.5), 0 0 10px ${box.color}80`,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {/* Label */}
                        <div
                            className="absolute -top-7 left-0 px-2 py-1 rounded text-xs font-semibold text-white whitespace-nowrap"
                            style={{
                                backgroundColor: box.color,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                        >
                            {box.label}
                            {confidence != null && (
                                <span className="ml-2 opacity-80 text-[10px]">
                                    {confidence}%
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
