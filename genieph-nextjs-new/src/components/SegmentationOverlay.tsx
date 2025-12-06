'use client';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { decodeRLE } from '@/lib/utils/segmentation';
import { SegmentationResult } from '@/types';

interface SegmentationOverlayProps {
    segmentationData: SegmentationResult;
    originalWidth: number; // Not used for rendering logic anymore, but kept for interface compat
    originalHeight: number;
    displayWidth: number;
    displayHeight: number;
    onSelect: (groupId: string) => void;
    selectedId: string | null;
    className?: string;
}

export const SegmentationOverlay: React.FC<SegmentationOverlayProps> = ({
    segmentationData,
    displayWidth,
    displayHeight,
    onSelect,
    selectedId,
    className
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // Animation state
    const [pulseAlpha, setPulseAlpha] = useState(0.3); // Default to visible (30%)
    const requestRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);

    // 1. Decode and Cache Masks as Offscreen Canvases
    // This runs only when segmentationData changes.
    // We create a mini-canvas for EACH mask. This allows fast composition.
    const maskLayers = useMemo(() => {
        if (!segmentationData?.items) return [];

        console.log(`🎨 Decoding ${segmentationData.items.length} masks...`);

        return segmentationData.items
            .filter(item => item.mask !== null)
            .map((item, index) => {
                const h = item.mask!.size[0];
                const w = item.mask!.size[1];
                const decoded = decodeRLE(item.mask!.counts, h, w);

                // Create offscreen canvas for this mask
                const offscreen = document.createElement('canvas');
                offscreen.width = w;
                offscreen.height = h;
                const ctx = offscreen.getContext('2d');
                if (!ctx) return null;

                const imgData = ctx.createImageData(w, h);
                const data = imgData.data;

                // Fill with solid color (white) - we will tint it via globalCompositeOperation or just use it as alpha mask
                // Actually, let's pre-color it purple for simplicity, but keep alpha 255 so we can modulate it later.
                // Purple: R=147, G=51, B=234
                for (let i = 0; i < decoded.length; i++) {
                    if (decoded[i] === 1) {
                        const idx = i * 4;
                        data[idx] = 147;     // R
                        data[idx + 1] = 51;  // G
                        data[idx + 2] = 234; // B
                        data[idx + 3] = 255; // Alpha (Full)
                    }
                }

                // Handle column-major vs row-major if needed. 
                // SAM RLE decoding usually returns column-major? 
                // Our decodeRLE utility handles it? 
                // Let's assume decodeRLE returns a flat array in the correct order for the image.
                // If decodeRLE returns column-major, we need to transpose. 
                // Based on previous code: `const idx = x * h + y;` (Column Major).
                // But `imgData` is Row Major.
                // So we need to map correctly.

                // RE-IMPLEMENTING PIXEL FILLING TO BE SAFE:
                const fixedData = new Uint8ClampedArray(w * h * 4);
                let pixelCount = 0;
                for (let x = 0; x < w; x++) {
                    for (let y = 0; y < h; y++) {
                        // SAM (Column-Major): index = x * h + y
                        const samIdx = x * h + y;

                        if (decoded[samIdx] === 1) {
                            pixelCount++;
                            // Canvas (Row-Major): index = (y * w + x) * 4
                            const canvasIdx = (y * w + x) * 4;
                            fixedData[canvasIdx] = 147;
                            fixedData[canvasIdx + 1] = 51;
                            fixedData[canvasIdx + 2] = 234;
                            fixedData[canvasIdx + 3] = 255;
                        }
                    }
                }

                // console.log(`   Mask ${item.group_id}: ${pixelCount} pixels`);

                const newImgData = new ImageData(fixedData, w, h);
                ctx.putImageData(newImgData, 0, 0);

                // Generate consistent group_id to match bottom sheet
                const group_id = item.group_id || `object_${index}`;

                return {
                    ...item,
                    group_id,  // Add group_id for consistent identification
                    canvas: offscreen,
                    width: w,
                    height: h
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [segmentationData]);

    // 2. Animation Loop (Pulse Effect)
    useEffect(() => {
        if (maskLayers.length === 0) return;

        console.log('⚡ Starting flash animation...');
        startTimeRef.current = Date.now();

        const animate = () => {
            const now = Date.now();
            const elapsed = now - (startTimeRef.current || now);

            // Pulse duration: 3000ms
            if (elapsed < 3000) {
                // Sine wave: 0.3 to 0.7 opacity
                // Frequency: 3 full cycles in 3 seconds -> 1 cycle per second
                const cycle = (Math.sin(elapsed * 0.006) + 1) / 2; // 0 to 1
                const alpha = 0.3 + (cycle * 0.4); // 0.3 to 0.7
                setPulseAlpha(alpha);
                requestRef.current = requestAnimationFrame(animate);
            } else {
                setPulseAlpha(0.3); // Settle at 0.3
            }
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [maskLayers]);

    // 3. Main Render Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Optimize scaling quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';

        // Only render if there's a selected or hovered mask
        // If null, render nothing (clean slate)
        const activeId = selectedId || hoveredId;

        if (activeId) {
            console.log(`🎭 Rendering mask with ID: ${activeId}`);
            const activeLayer = maskLayers.find(layer => layer.group_id === activeId);

            if (activeLayer) {
                const isHovered = activeLayer.group_id === hoveredId;
                const isSelected = activeLayer.group_id === selectedId;

                // Determine opacity
                let alpha = 0.5; // Default
                if (isHovered) alpha = 0.6;
                if (isSelected) alpha = 0.8;

                ctx.globalAlpha = alpha;

                // Draw the pre-rendered mask scaled to the display size
                ctx.drawImage(activeLayer.canvas, 0, 0, displayWidth, displayHeight);
                console.log(`✅ Rendered mask ${activeId} with alpha ${alpha}`);
            } else {
                console.warn(`⚠️ Mask ${activeId} not found in layers`, maskLayers.map(l => l.group_id));
            }
        } else {
            console.log(`🔍 No mask selected (selectedId: ${selectedId}, hoveredId: ${hoveredId})`);
        }

    }, [maskLayers, hoveredId, selectedId, displayWidth, displayHeight]);

    // 4. Interaction Handling (Hit Testing)
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Scale mouse coordinates to display size (should match, but to be safe)
        // Then we need to map this to the mask's internal coordinate system?
        // NO, we have the masks as canvases.
        // But checking pixel data on the main canvas is hard because they are blended.

        // Better approach: Check the original masks (in memory)
        // We need to scale the mouse pointer from Display Space -> Mask Space.
        // Assuming all masks have the same resolution (from the same SAM inference).
        if (maskLayers.length === 0) return;

        const maskW = maskLayers[0].width;
        const maskH = maskLayers[0].height;

        const scaleX = maskW / displayWidth;
        const scaleY = maskH / displayHeight;

        const maskX = Math.floor(x * scaleX);
        const maskY = Math.floor(y * scaleY);

        // Find top-most mask at this pixel
        let foundId = null;
        // Iterate reverse to find top-most
        for (let i = maskLayers.length - 1; i >= 0; i--) {
            const layer = maskLayers[i];
            const ctx = layer.canvas.getContext('2d');
            // Reading 1 pixel from offscreen canvas is fast enough
            const pixel = ctx?.getImageData(maskX, maskY, 1, 1).data;
            if (pixel && pixel[3] > 0) { // Alpha > 0
                foundId = layer.group_id;
                break;
            }
        }

        setHoveredId(foundId);
        canvasRef.current!.style.cursor = foundId ? 'pointer' : 'default';
    };

    const handleClick = () => {
        if (hoveredId) {
            onSelect(hoveredId);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            width={displayWidth}
            height={displayHeight}
            className={className}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredId(null)}
            onClick={handleClick}
        />
    );
};
