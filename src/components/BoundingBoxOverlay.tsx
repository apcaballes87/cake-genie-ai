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
    /** When true, bbox coordinates use Gemini's 0–1000 normalized, top-left coordinate space. When false, center-origin app coordinates (legacy). */
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

const MEASUREMENT_COLORS = {
    diameter: '#22C55E',
    height: '#0EA5E9',
};

/**
 * Scale a Gemini bbox from its normalized 0–1000, top-left coordinate space
 * to the rendered image. Gemini emits this normalized space regardless of the
 * original file's natural pixel dimensions.
 */
function normalizedToDisplay(
    x: number,
    y: number,
    width: number,
    height: number,
    containerWidth: number,
    containerHeight: number,
): { left: number; top: number; width: number; height: number } {
    const scaleX = containerWidth / 1000;
    const scaleY = containerHeight / 1000;
    return {
        left: x * scaleX,
        top: y * scaleY,
        width: width * scaleX,
        height: height * scaleY,
    };
}

function normalizedPointToDisplay(
    point: { x: number; y: number },
    containerWidth: number,
    containerHeight: number,
): { x: number; y: number } {
    return {
        x: point.x * (containerWidth / 1000),
        y: point.y * (containerHeight / 1000),
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
 * Renders bounding boxes for detected elements and measurement lines for the cake body
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
    const measurementLines: Array<{
        left: number;
        top: number;
        width: number;
        height: number;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        midpointX: number;
        midpointY: number;
        length: number;
        angle: number;
        label: string;
        testId: string;
        ariaLabel: string;
        color: string;
    }> = [];
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

    const addMeasurementLine = (
        startPoint: { x: number; y: number },
        endPoint: { x: number; y: number },
        label: string,
        color: string,
        testId = `cake-measurement-${label.toLowerCase()}`,
        ariaLabel = `Cake ${label.toLowerCase()} measurement line`,
    ) => {
        const start = normalizedPointToDisplay(startPoint, containerWidth, containerHeight);
        const end = normalizedPointToDisplay(endPoint, containerWidth, containerHeight);
        const left = Math.min(start.x, end.x) + offsetX;
        const top = Math.min(start.y, end.y) + offsetY;
        const startX = start.x + offsetX - left;
        const startY = start.y + offsetY - top;
        const endX = end.x + offsetX - left;
        const endY = end.y + offsetY - top;
        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;

        measurementLines.push({
            left,
            top,
            width: Math.abs(deltaX),
            height: Math.abs(deltaY),
            startX,
            startY,
            endX,
            endY,
            midpointX: (startX + endX) / 2,
            midpointY: (startY + endY) / 2,
            length: Math.hypot(deltaX, deltaY),
            angle: Math.atan2(deltaY, deltaX) * (180 / Math.PI),
            label,
            testId,
            ariaLabel,
            color,
        });
    };

    const addElementSizeLine = (
        startPoint: { x: number; y: number },
        endPoint: { x: number; y: number },
        label: string,
        color: string,
        role: 'topper' | 'support',
        index: number,
    ) => {
        addMeasurementLine(
            startPoint,
            endPoint,
            label,
            color,
            `element-size-line-${role}-${index}`,
            `${role === 'topper' ? 'Topper' : 'Support element'} size measurement line`,
        );
    };

    if (analysisResult.cake_measurements) {
        addMeasurementLine(
            analysisResult.cake_measurements.diameter.start,
            analysisResult.cake_measurements.diameter.end,
            'Diameter',
            MEASUREMENT_COLORS.diameter,
        );
        addMeasurementLine(
            analysisResult.cake_measurements.height.start,
            analysisResult.cake_measurements.height.end,
            'Height',
            MEASUREMENT_COLORS.height,
        );
    } else if (analysisResult.cake_bbox) {
        // Legacy cached analyses only have a cake bbox. Derive centered endpoints
        // so those records continue to render until they are naturally refreshed.
        const cb = analysisResult.cake_bbox;
        addMeasurementLine(
            { x: cb.x, y: cb.y + (cb.height / 2) },
            { x: cb.x + cb.width, y: cb.y + (cb.height / 2) },
            'Diameter',
            MEASUREMENT_COLORS.diameter,
        );
        addMeasurementLine(
            { x: cb.x + (cb.width / 2), y: cb.y },
            { x: cb.x + (cb.width / 2), y: cb.y + cb.height },
            'Height',
            MEASUREMENT_COLORS.height,
        );
    }

    // Fresh priced elements use size lines; legacy cached elements continue to
    // render their persisted bboxes until they are naturally refreshed.
    const collectElementBbox = (
        bbox: AnyBoundingBox | undefined,
        label: string,
        color: string,
        type: string,
    ) => {
        if (!bbox) return;
        if (useTopLeftOrigin) {
            // Gemini normalized coordinates (0–1000, top-left origin)
            const display = applyImageOffset(normalizedToDisplay(bbox.x, bbox.y, bbox.width, bbox.height, containerWidth, containerHeight));
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
        if (topper.size_line) {
            addElementSizeLine(
                topper.size_line.start,
                topper.size_line.end,
                topper.description || `Topper ${index + 1}`,
                COLORS.main_topper,
                'topper',
                index,
            );
        } else {
            collectElementBbox(
                topper.bbox,
                topper.description || `Topper ${index + 1}`,
                COLORS.main_topper,
                'topper',
            );
        }
    });

    analysisResult.support_elements?.forEach((element, index) => {
        if (element.size_line) {
            addElementSizeLine(
                element.size_line.start,
                element.size_line.end,
                element.description || `Element ${index + 1}`,
                COLORS.support_element,
                'support',
                index,
            );
        } else {
            collectElementBbox(
                element.bbox,
                element.description || `Element ${index + 1}`,
                COLORS.support_element,
                'support',
            );
        }
    });

    analysisResult.cake_messages?.forEach((message, index) => {
        collectElementBbox(
            message.bbox,
            message.text || `Message ${index + 1}`,
            COLORS.cake_message,
            'message',
        );
    });

    if (boxes.length === 0 && measurementLines.length === 0) {
        return null;
    }

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {measurementLines.map((line) => {
                const markerStyle = {
                    position: 'absolute' as const,
                    width: '10px',
                    height: '10px',
                    border: `2px solid ${line.color}`,
                    borderRadius: '9999px',
                    backgroundColor: 'white',
                    boxSizing: 'border-box' as const,
                };

                return (
                    <div
                        key={line.testId}
                        data-testid={line.testId}
                        aria-label={line.ariaLabel}
                        className="absolute"
                        style={{
                            left: `${line.left}px`,
                            top: `${line.top}px`,
                            width: `${line.width}px`,
                            height: `${line.height}px`,
                        }}
                    >
                        <div
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                left: `${line.startX}px`,
                                top: `${line.startY - 1.5}px`,
                                width: `${line.length}px`,
                                height: '3px',
                                backgroundColor: line.color,
                                transform: `rotate(${line.angle}deg)`,
                                transformOrigin: 'left center',
                            }}
                        />
                        <span
                            aria-hidden="true"
                            style={{
                                ...markerStyle,
                                left: `${line.startX - 5}px`,
                                top: `${line.startY - 5}px`,
                            }}
                        />
                        <span
                            aria-hidden="true"
                            style={{
                                ...markerStyle,
                                left: `${line.endX - 5}px`,
                                top: `${line.endY - 5}px`,
                            }}
                        />
                        <span
                            className="absolute px-2 py-1 rounded text-xs font-semibold text-white whitespace-nowrap"
                            style={{
                                backgroundColor: line.color,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                left: `${line.midpointX}px`,
                                top: `${line.midpointY - 18}px`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {line.label}
                        </span>
                    </div>
                );
            })}
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
