'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { HybridAnalysisResult, BoundingBox } from '@/types';
import type {
    GeneratedBox2D,
    GeneratedIntegratedBboxConfidence,
    GeneratedIntegratedBox2D,
} from '@/lib/ai/generatedAnalysisContract';

type AnyBoundingBox = BoundingBox | { x: number; y: number; width: number; height: number };

export type DecorationBoxTarget = {
    category: 'topper' | 'support';
    groupId: string;
    label: string;
};

export type CakeMessageBoxTarget = {
    /** Cake messages are unique by surface, unlike topper/support groups. */
    position: 'top' | 'side' | 'base_board';
    label: string;
};

export type RenderedBox = {
    left: number;
    top: number;
    width: number;
    height: number;
    label: string;
    color: string;
    type: string;
    dashed?: boolean;
    confidence?: number;
    target?: DecorationBoxTarget;
    messageTarget?: CakeMessageBoxTarget;
};

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
    /** Hide the cake diameter/height measurement lines while retaining detected-element boxes. */
    showCakeMeasurementLines?: boolean;
    /** Decorations that currently have an editable customizer card. Unmatched boxes remain visual-only. */
    editableDecorationTargets?: readonly DecorationBoxTarget[];
    /** Called with every editable decoration at a tapped point, deduplicated by category and group id. */
    onDecorationActivate?: (targets: DecorationBoxTarget[]) => void;
    /** Cake-message inputs currently available in the inline customizer form, keyed by their unique surface. */
    editableCakeMessageTargets?: readonly CakeMessageBoxTarget[];
    /** Opens and focuses an inline cake-message form rather than an editor sheet. */
    onCakeMessageActivate?: (position: CakeMessageBoxTarget['position']) => void;
    /** Clears the active box selection when the hero image or surrounding screen is tapped elsewhere. */
    onBackgroundActivate?: () => void;
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

function isWithinBounds(
    point: { x: number; y: number },
    box: Pick<RenderedBox, 'left' | 'top' | 'width' | 'height'>,
): boolean {
    return point.x >= box.left
        && point.x <= box.left + box.width
        && point.y >= box.top
        && point.y <= box.top + box.height;
}

function getMinimumTouchBounds(box: Pick<RenderedBox, 'left' | 'top' | 'width' | 'height'>) {
    const width = Math.max(box.width, 44);
    const height = Math.max(box.height, 44);

    return {
        left: box.left - ((width - box.width) / 2),
        top: box.top - ((height - box.height) / 2),
        width,
        height,
    };
}

/**
 * Resolve a pointer position using the visible box first, then a 44px minimum
 * target only when no visible decoration was hit. Multiple unit boxes for one
 * detected group still open a single customizer card.
 */
export function getDecorationTargetsAtPoint(
    boxes: readonly RenderedBox[],
    point: { x: number; y: number },
): DecorationBoxTarget[] {
    const editableBoxes = boxes.filter((box): box is RenderedBox & { target: DecorationBoxTarget } => Boolean(box.target));
    const exactMatches = editableBoxes.filter((box) => isWithinBounds(point, box));
    const matches = exactMatches.length > 0
        ? exactMatches
        : editableBoxes.filter((box) => isWithinBounds(point, getMinimumTouchBounds(box)));
    const seen = new Set<string>();

    return matches.flatMap((box) => {
        const key = `${box.target.category}:${box.target.groupId}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [box.target];
    });
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
    showCakeMeasurementLines = true,
    editableDecorationTargets = [],
    onDecorationActivate,
    editableCakeMessageTargets = [],
    onCakeMessageActivate,
    onBackgroundActivate,
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [activeDecorationTargetKeys, setActiveDecorationTargetKeys] = useState<Set<string>>(() => new Set());
    const [activeCakeMessagePosition, setActiveCakeMessagePosition] = useState<CakeMessageBoxTarget['position'] | null>(null);

    useEffect(() => {
        if (activeDecorationTargetKeys.size === 0 && activeCakeMessagePosition === null) return;

        const handleBackgroundPointerDown = (event: PointerEvent) => {
            const overlay = overlayRef.current;
            const target = event.target;
            if (!overlay || !(target instanceof Element)) return;

            if (target.closest('[data-bbox-interactive="true"]')) return;
            if (target.closest('[role="dialog"]')) return;

            setActiveDecorationTargetKeys(new Set());
            setActiveCakeMessagePosition(null);
            onBackgroundActivate?.();
        };

        window.addEventListener('pointerdown', handleBackgroundPointerDown);
        return () => window.removeEventListener('pointerdown', handleBackgroundPointerDown);
    }, [activeCakeMessagePosition, activeDecorationTargetKeys, onBackgroundActivate]);
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
    const boxes: RenderedBox[] = [];
    const editableTargetKeys = new Set(editableDecorationTargets.map((target) => `${target.category}:${target.groupId}`));
    const editableCakeMessageTargetsByPosition = new Map(
        editableCakeMessageTargets.map((target) => [target.position, target]),
    );
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

    if (showCakeMeasurementLines && analysisResult.geometry?.cake_diameter_line && analysisResult.geometry.cake_height_line) {
        // integrated_bbox_v1 points are [y, x], unlike the legacy { x, y }
        // measurement objects retained for historical cache rows.
        addMeasurementLine(
            { x: analysisResult.geometry.cake_diameter_line.start[1], y: analysisResult.geometry.cake_diameter_line.start[0] },
            { x: analysisResult.geometry.cake_diameter_line.end[1], y: analysisResult.geometry.cake_diameter_line.end[0] },
            'Diameter',
            MEASUREMENT_COLORS.diameter,
        );
        addMeasurementLine(
            { x: analysisResult.geometry.cake_height_line.start[1], y: analysisResult.geometry.cake_height_line.start[0] },
            { x: analysisResult.geometry.cake_height_line.end[1], y: analysisResult.geometry.cake_height_line.end[0] },
            'Height',
            MEASUREMENT_COLORS.height,
        );
    } else if (showCakeMeasurementLines && analysisResult.cake_measurements) {
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
    } else if (showCakeMeasurementLines && analysisResult.cake_bbox) {
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
        target?: DecorationBoxTarget,
        messageTarget?: CakeMessageBoxTarget,
    ) => {
        if (!bbox) return;
        if (useTopLeftOrigin) {
            // Gemini normalized coordinates (0–1000, top-left origin)
            const display = applyImageOffset(normalizedToDisplay(bbox.x, bbox.y, bbox.width, bbox.height, containerWidth, containerHeight));
            boxes.push({ ...display, label, color, type, target, messageTarget });
        } else {
            // Legacy center-origin app coordinates
            const display = applyImageOffset(appCoordinatesToDisplay(bbox.x, bbox.y, bbox.width, bbox.height, imageWidth, imageHeight, containerWidth, containerHeight));
            boxes.push({
                ...display,
                label,
                color,
                type,
                confidence: 'confidence' in bbox ? bbox.confidence : undefined,
                target,
                messageTarget,
            });
        }
    };

    const collectIntegratedBox = (
        box2d: GeneratedIntegratedBox2D | undefined,
        confidence: GeneratedIntegratedBboxConfidence | undefined,
        label: string,
        color: string,
        type: string,
        target?: DecorationBoxTarget,
        messageTarget?: CakeMessageBoxTarget,
    ) => {
        if (!box2d) return;
        const unitBoxes: GeneratedBox2D[] = box2d.length === 4 && box2d.every((value) => typeof value === 'number')
            ? [box2d as GeneratedBox2D]
            : box2d as GeneratedBox2D[];
        const unitConfidences = Array.isArray(confidence)
            ? confidence
            : unitBoxes.map(() => confidence);
        unitBoxes.forEach(([ymin, xmin, ymax, xmax], unitIndex) => {
            const display = applyImageOffset(normalizedToDisplay(
                xmin,
                ymin,
                xmax - xmin,
                ymax - ymin,
                containerWidth,
                containerHeight,
            ));
            boxes.push({
                ...display,
                label: unitBoxes.length > 1 ? `${label} ${unitIndex + 1}` : label,
                color,
                type,
                confidence: unitConfidences[unitIndex],
                target,
                messageTarget,
            });
        });
    };

    const getEditableTarget = (
        category: DecorationBoxTarget['category'],
        groupId: string | undefined,
        label: string,
    ): DecorationBoxTarget | undefined => {
        if (!groupId || !editableTargetKeys.has(`${category}:${groupId}`)) return undefined;
        return { category, groupId, label };
    };

    analysisResult.main_toppers?.forEach((topper, index) => {
        const target = getEditableTarget(
            'topper',
            topper.group_id,
            topper.description || `Topper ${index + 1}`,
        );
        if (topper.box_2d) {
            collectIntegratedBox(
                topper.box_2d,
                topper.bbox_confidence,
                topper.description || `Topper ${index + 1}`,
                COLORS.main_topper,
                'topper',
                target,
            );
        } else if (topper.size_line) {
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
                target,
            );
        }
    });

    analysisResult.support_elements?.forEach((element, index) => {
        const target = getEditableTarget(
            'support',
            element.group_id,
            element.description || `Element ${index + 1}`,
        );
        if (element.box_2d) {
            collectIntegratedBox(
                element.box_2d,
                element.bbox_confidence,
                element.description || `Element ${index + 1}`,
                COLORS.support_element,
                'support',
                target,
            );
        } else if (element.size_line) {
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
                target,
            );
        }
    });

    analysisResult.cake_messages?.forEach((message, index) => {
        const messageTarget = editableCakeMessageTargetsByPosition.get(message.position);
        if (message.box_2d) {
            collectIntegratedBox(
                message.box_2d,
                message.bbox_confidence,
                message.text || `Message ${index + 1}`,
                COLORS.cake_message,
                'message',
                undefined,
                messageTarget,
            );
        } else {
            collectElementBbox(
                message.bbox,
                message.text || `Message ${index + 1}`,
                COLORS.cake_message,
                'message',
                undefined,
                messageTarget,
            );
        }
    });

    if (boxes.length === 0 && measurementLines.length === 0) {
        return null;
    }

    const setActiveDecorationTargets = (targets: readonly DecorationBoxTarget[]) => {
        setActiveDecorationTargetKeys(new Set(targets.map((target) => `${target.category}:${target.groupId}`)));
        setActiveCakeMessagePosition(null);
    };

    const activateCakeMessage = (target: CakeMessageBoxTarget) => {
        setActiveDecorationTargetKeys(new Set());
        setActiveCakeMessagePosition(target.position);
        onCakeMessageActivate?.(target.position);
    };

    return (
        <div ref={overlayRef} data-testid="bounding-box-overlay" className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
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
                const touchBounds = getMinimumTouchBounds(box);
                const targetKey = box.target ? `${box.target.category}:${box.target.groupId}` : null;
                const isActive = (targetKey !== null && activeDecorationTargetKeys.has(targetKey))
                    || box.messageTarget?.position === activeCakeMessagePosition;
                const shouldShowLabel = (!onDecorationActivate && !onCakeMessageActivate) || isActive;

                const targetsAtPointer = (event: React.PointerEvent<HTMLButtonElement>): DecorationBoxTarget[] => {
                    if (!box.target) return [];
                    const overlayBounds = overlayRef.current?.getBoundingClientRect();
                    if (!overlayBounds) return [box.target];
                    const targets = getDecorationTargetsAtPoint(boxes, {
                        x: event.clientX - overlayBounds.left,
                        y: event.clientY - overlayBounds.top,
                    });
                    return targets.length > 0 ? targets : [box.target];
                };

                const activateAtPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
                    if (!onDecorationActivate || !box.target || event.button !== 0) return;
                    const targets = targetsAtPointer(event);
                    setActiveDecorationTargets(targets);
                    onDecorationActivate(targets);
                };

                return (
                    <React.Fragment key={`${box.type}-${index}`}>
                        {box.target && onDecorationActivate ? (
                            <button
                                type="button"
                                data-testid={`decoration-hit-${box.target.category}-${index}`}
                                data-bbox-interactive="true"
                                aria-label={`Edit ${box.target.label}`}
                                aria-pressed={isActive}
                                className="absolute pointer-events-auto cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
                                style={{
                                    left: `${touchBounds.left}px`,
                                    top: `${touchBounds.top}px`,
                                    width: `${touchBounds.width}px`,
                                    height: `${touchBounds.height}px`,
                                }}
                                onPointerDown={(event) => {
                                    if (event.button !== 0) return;
                                    setActiveDecorationTargets(targetsAtPointer(event));
                                }}
                                onPointerUp={activateAtPointer}
                                onClick={(event) => {
                                    // Keyboard activation identifies the focused box directly.
                                    if (event.detail === 0) {
                                        setActiveDecorationTargets([box.target!]);
                                        onDecorationActivate([box.target!]);
                                    }
                                }}
                            />
                        ) : box.messageTarget && onCakeMessageActivate ? (
                            <button
                                type="button"
                                data-testid={`cake-message-hit-${index}`}
                                data-bbox-interactive="true"
                                aria-label={`Edit cake message ${box.messageTarget.label}`}
                                aria-pressed={isActive}
                                className="absolute pointer-events-auto cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
                                style={{
                                    left: `${touchBounds.left}px`,
                                    top: `${touchBounds.top}px`,
                                    width: `${touchBounds.width}px`,
                                    height: `${touchBounds.height}px`,
                                }}
                                onPointerDown={(event) => {
                                    if (event.button !== 0) return;
                                    setActiveDecorationTargetKeys(new Set());
                                    setActiveCakeMessagePosition(box.messageTarget!.position);
                                }}
                                onPointerUp={(event) => {
                                    if (event.button !== 0) return;
                                    activateCakeMessage(box.messageTarget!);
                                }}
                                onClick={(event) => {
                                    if (event.detail === 0) activateCakeMessage(box.messageTarget!);
                                }}
                            />
                        ) : null}
                        <div
                            data-testid={`bounding-box-${box.type}-${index}`}
                            className="absolute pointer-events-none"
                            style={{
                                left: `${box.left}px`,
                                top: `${box.top}px`,
                                width: `${box.width}px`,
                                height: `${box.height}px`,
                            }}
                        >
                            <div
                                data-testid={`bounding-box-outline-${box.type}-${index}`}
                                className="absolute inset-0"
                                style={{
                                    border: box.dashed
                                        ? `1px dashed ${box.color}`
                                        : `1px solid ${box.color}`,
                                    borderRadius: '4px',
                                    boxShadow: isActive ? `0 0 12px ${box.color}` : 'none',
                                    opacity: 0.5,
                                    transition: 'all 0.2s ease',
                                }}
                            />
                            {shouldShowLabel ? (
                            <div
                                data-testid={`bounding-box-label-${box.type}-${index}`}
                                className="absolute -top-7 left-0 px-2 py-1 rounded text-[9px] font-semibold text-white whitespace-nowrap"
                                style={{
                                    backgroundColor: box.color,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                            >
                                {box.label}
                                {confidence != null && (
                                    <span className="ml-2 opacity-80 text-[7px]">
                                        {confidence}%
                                    </span>
                                )}
                            </div>
                            ) : null}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};
