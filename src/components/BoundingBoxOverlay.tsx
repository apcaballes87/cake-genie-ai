'use client';
import React from 'react';
import type { HybridAnalysisResult, BoundingBox } from '@/types';

interface BoundingBoxOverlayProps {
    analysisResult: HybridAnalysisResult;
    containerWidth: number;
    containerHeight: number;
    imageWidth: number;
    imageHeight: number;
}

/**
 * Color palette for different element types
 */
const COLORS = {
    main_topper: '#10B981',      // Green
    support_element: '#3B82F6',  // Blue
    cake_message: '#F59E0B',     // Amber
    default: '#8B5CF6'           // Purple
};

/**
 * Convert app coordinates (center origin) to display pixels
 */
function appCoordinatesToDisplay(
    appX: number,
    appY: number,
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number
): { x: number; y: number } {
    // Convert from center origin to top-left origin
    const imgX = appX + (imageWidth / 2);
    const imgY = (imageHeight / 2) - appY;  // Y is inverted in app coordinates

    // Scale to container size
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;

    return {
        x: imgX * scaleX,
        y: imgY * scaleY
    };
}

/**
 * Renders bounding boxes for detected elements
 */
export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
    analysisResult,
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight
}) => {
    const boxes: Array<{
        bbox: BoundingBox;
        label: string;
        color: string;
        type: string;
    }> = [];

    // Collect bounding boxes from all elements
    analysisResult.main_toppers?.forEach((topper, index) => {
        if (topper.bbox) {
            boxes.push({
                bbox: topper.bbox,
                label: topper.description || `Topper ${index + 1}`,
                color: COLORS.main_topper,
                type: 'topper'
            });
        }
    });

    analysisResult.support_elements?.forEach((element, index) => {
        if (element.bbox) {
            boxes.push({
                bbox: element.bbox,
                label: element.description || `Element ${index + 1}`,
                color: COLORS.support_element,
                type: 'support'
            });
        }
    });

    analysisResult.cake_messages?.forEach((message, index) => {
        if (message.bbox) {
            boxes.push({
                bbox: message.bbox,
                label: message.text || `Message ${index + 1}`,
                color: COLORS.cake_message,
                type: 'message'
            });
        }
    });

    if (boxes.length === 0) {
        return null; // No bounding boxes to display
    }

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {boxes.map((box, index) => {
                // Convert app coordinates to display pixels
                const topLeft = appCoordinatesToDisplay(
                    box.bbox.x,
                    box.bbox.y,
                    imageWidth,
                    imageHeight,
                    containerWidth,
                    containerHeight
                );

                // Scale bbox dimensions
                const scaleX = containerWidth / imageWidth;
                const scaleY = containerHeight / imageHeight;
                const width = box.bbox.width * scaleX;
                const height = box.bbox.height * scaleY;

                const confidence = Math.round(box.bbox.confidence * 100);

                return (
                    <div
                        key={`${box.type}-${index}`}
                        className="absolute"
                        style={{
                            left: `${topLeft.x}px`,
                            top: `${topLeft.y}px`,
                            width: `${width}px`,
                            height: `${height}px`,
                            border: `3px solid ${box.color}`,
                            borderRadius: '4px',
                            boxShadow: `0 0 0 2px rgba(255, 255, 255, 0.5), 0 0 10px ${box.color}80`,
                            transition: 'all 0.2s ease'
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
                            <span className="ml-2 opacity-80 text-[10px]">
                                {confidence}%
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
