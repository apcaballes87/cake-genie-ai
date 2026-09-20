import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HybridAnalysisResult } from '@/types';
import {
    BoundingBoxOverlay,
    getDecorationTargetsAtPoint,
    type RenderedBox,
} from './BoundingBoxOverlay';

describe('BoundingBoxOverlay', () => {
    it('activates a matched topper box as an accessible minimum-size target', () => {
        const onDecorationActivate = vi.fn();
        const analysisResult = {
            main_toppers: [{
                group_id: 'tiny-bow',
                description: 'Tiny bow',
                box_2d: [100, 100, 110, 110],
            }],
            support_elements: [],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1000}
                imageHeight={1000}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
                editableDecorationTargets={[{ category: 'topper', groupId: 'tiny-bow', label: 'Tiny bow' }]}
                onDecorationActivate={onDecorationActivate}
            />
        );

        const target = screen.getByRole('button', { name: 'Edit Tiny bow' });
        expect(target).toHaveStyle({ left: '83px', top: '83px', width: '44px', height: '44px' });
        expect(target).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByTestId('bounding-box-label-topper-0')).not.toBeInTheDocument();
        expect(screen.getByTestId('bounding-box-outline-topper-0')).toHaveStyle({ opacity: '0.5' });
        fireEvent.click(target);

        expect(onDecorationActivate).toHaveBeenCalledWith([
            { category: 'topper', groupId: 'tiny-bow', label: 'Tiny bow' },
        ]);
        expect(target).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('bounding-box-label-topper-0')).toHaveTextContent('Tiny bow');
        expect(screen.getByTestId('bounding-box-outline-topper-0').style.boxShadow).toContain('#10B981');
    });

    it('returns every exact overlapping decoration while deduplicating repeated unit boxes', () => {
        const boxes: RenderedBox[] = [
            {
                left: 10, top: 10, width: 50, height: 50, label: 'Sugar flower', color: '#10B981', type: 'topper',
                target: { category: 'topper', groupId: 'sugar-flowers', label: 'Sugar flower' },
            },
            {
                left: 20, top: 20, width: 20, height: 20, label: 'Sugar flower 2', color: '#10B981', type: 'topper',
                target: { category: 'topper', groupId: 'sugar-flowers', label: 'Sugar flower' },
            },
            {
                left: 15, top: 15, width: 30, height: 30, label: 'Ribbon', color: '#3B82F6', type: 'support',
                target: { category: 'support', groupId: 'ribbon', label: 'Ribbon' },
            },
        ];

        expect(getDecorationTargetsAtPoint(boxes, { x: 25, y: 25 })).toEqual([
            { category: 'topper', groupId: 'sugar-flowers', label: 'Sugar flower' },
            { category: 'support', groupId: 'ribbon', label: 'Ribbon' },
        ]);
    });

    it('keeps decoration targets available while moving the active label and glow to the next selection', () => {
        const onDecorationActivate = vi.fn();
        const analysisResult = {
            main_toppers: [{ group_id: 'topper-a', description: 'Topper A', box_2d: [100, 100, 200, 200] }],
            support_elements: [{ group_id: 'support-b', description: 'Support B', box_2d: [400, 400, 500, 500] }],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1000}
                imageHeight={1000}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
                editableDecorationTargets={[
                    { category: 'topper', groupId: 'topper-a', label: 'Topper A' },
                    { category: 'support', groupId: 'support-b', label: 'Support B' },
                ]}
                onDecorationActivate={onDecorationActivate}
            />
        );

        const topperButton = screen.getByRole('button', { name: 'Edit Topper A' });
        const supportButton = screen.getByRole('button', { name: 'Edit Support B' });

        fireEvent.click(topperButton);
        expect(topperButton).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('bounding-box-label-topper-0')).toHaveTextContent('Topper A');

        fireEvent.click(supportButton);
        expect(topperButton).toHaveAttribute('aria-pressed', 'false');
        expect(supportButton).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByTestId('bounding-box-label-topper-0')).not.toBeInTheDocument();
        expect(screen.getByTestId('bounding-box-label-support-1')).toHaveTextContent('Support B');
        expect(onDecorationActivate).toHaveBeenLastCalledWith([
            { category: 'support', groupId: 'support-b', label: 'Support B' },
        ]);
    });

    it('routes a clicked cake-message box to its inline form instead of a decoration sheet', () => {
        const onCakeMessageActivate = vi.fn();
        const analysisResult = {
            main_toppers: [],
            support_elements: [],
            cake_messages: [{
                text: 'Happy Birthday',
                position: 'side',
                box_2d: [300, 200, 350, 600],
            }],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1000}
                imageHeight={1000}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
                editableCakeMessageTargets={[{ position: 'side', label: 'Happy Birthday' }]}
                onCakeMessageActivate={onCakeMessageActivate}
            />
        );

        const target = screen.getByRole('button', { name: 'Edit cake message Happy Birthday' });
        expect(screen.queryByTestId('bounding-box-label-message-0')).not.toBeInTheDocument();

        fireEvent.click(target);

        expect(onCakeMessageActivate).toHaveBeenCalledWith('side');
        expect(target).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('bounding-box-label-message-0')).toHaveTextContent('Happy Birthday');
    });

    it('emits every overlapping topper and support target for a pointer tap', () => {
        const onDecorationActivate = vi.fn();
        const analysisResult = {
            main_toppers: [{ group_id: 'flowers', description: 'Sugar flower', box_2d: [100, 100, 300, 300] }],
            support_elements: [{ group_id: 'ribbon', description: 'Blue ribbon', box_2d: [200, 200, 400, 400] }],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1000}
                imageHeight={1000}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
                editableDecorationTargets={[
                    { category: 'topper', groupId: 'flowers', label: 'Sugar flower' },
                    { category: 'support', groupId: 'ribbon', label: 'Blue ribbon' },
                ]}
                onDecorationActivate={onDecorationActivate}
            />
        );
        vi.spyOn(screen.getByTestId('bounding-box-overlay'), 'getBoundingClientRect').mockReturnValue({
            bottom: 1000, height: 1000, left: 0, right: 1000, top: 0, width: 1000,
            x: 0, y: 0, toJSON: () => ({}),
        });

        fireEvent.pointerUp(screen.getByTestId('decoration-hit-topper-0'), { clientX: 250, clientY: 250, button: 0 });

        expect(onDecorationActivate).toHaveBeenCalledWith([
            { category: 'topper', groupId: 'flowers', label: 'Sugar flower' },
            { category: 'support', groupId: 'ribbon', label: 'Blue ribbon' },
        ]);
    });

    it('uses the minimum touch target only when no visible box was hit', () => {
        const boxes: RenderedBox[] = [
            {
                left: 50, top: 50, width: 20, height: 20, label: 'Large topper', color: '#10B981', type: 'topper',
                target: { category: 'topper', groupId: 'large-topper', label: 'Large topper' },
            },
            {
                left: 100, top: 100, width: 5, height: 5, label: 'Tiny support', color: '#3B82F6', type: 'support',
                target: { category: 'support', groupId: 'tiny-support', label: 'Tiny support' },
            },
        ];

        expect(getDecorationTargetsAtPoint(boxes, { x: 85, y: 102 })).toEqual([
            { category: 'support', groupId: 'tiny-support', label: 'Tiny support' },
        ]);
        expect(getDecorationTargetsAtPoint(boxes, { x: 60, y: 60 })).toEqual([
            { category: 'topper', groupId: 'large-topper', label: 'Large topper' },
        ]);
    });

    it('scales normalized Gemini coordinates within the rendered image and preserves crop offsets', () => {
        const analysisResult = {
            cake_bbox: { x: 100, y: 50, width: 400, height: 200 },
            main_toppers: [{ description: 'Beach bucket', bbox: { x: 300, y: 100, width: 100, height: 80 } }],
            support_elements: [],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1000}
                imageHeight={500}
                containerWidth={500}
                containerHeight={250}
                offsetX={-40}
                offsetY={30}
                useTopLeftOrigin
            />
        );

        expect(screen.queryByText('Cake')).not.toBeInTheDocument();
        expect(screen.getByTestId('cake-measurement-diameter')).toHaveStyle({
            left: '10px',
            top: '67.5px',
            width: '200px',
            height: '0px',
        });
        expect(screen.getByText('Diameter')).toBeInTheDocument();
        expect(screen.getByTestId('cake-measurement-height')).toHaveStyle({
            left: '110px',
            top: '42.5px',
            width: '0px',
            height: '50px',
        });
        expect(screen.getByText('Height')).toBeInTheDocument();
        expect(screen.getByText('Beach bucket').parentElement).toHaveStyle({
            left: '110px',
            top: '55px',
            width: '50px',
            height: '20px',
        });
    });

    it('does not use a portrait source image pixel size to scale Gemini coordinates', () => {
        const analysisResult = {
            cake_bbox: { x: 125, y: 500, width: 500, height: 400 },
        } as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={400}
                imageHeight={533}
                containerWidth={800}
                containerHeight={1000}
                useTopLeftOrigin
            />
        );

        expect(screen.getByTestId('cake-measurement-diameter')).toHaveStyle({
            left: '100px',
            top: '700px',
            width: '400px',
            height: '0px',
        });
        expect(screen.getByTestId('cake-measurement-height')).toHaveStyle({
            left: '300px',
            top: '500px',
            width: '0px',
            height: '400px',
        });
    });

    it('uses explicit cake measurement endpoints while preserving topper boxes', () => {
        const analysisResult = {
            cake_measurements: {
                diameter: {
                    start: { x: 150, y: 600 },
                    end: { x: 850, y: 620 },
                },
                height: {
                    start: { x: 500, y: 300 },
                    end: { x: 520, y: 900 },
                },
            },
            main_toppers: [{ description: 'Flower', bbox: { x: 100, y: 100, width: 80, height: 80 } }],
            support_elements: [],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={400}
                imageHeight={533}
                containerWidth={800}
                containerHeight={1000}
                useTopLeftOrigin
            />
        );

        expect(screen.getByTestId('cake-measurement-diameter')).toHaveStyle({
            left: '120px',
            top: '600px',
            width: '560px',
            height: '20px',
        });
        expect((screen.getByTestId('cake-measurement-diameter').firstElementChild as HTMLElement).style.transform)
            .toMatch(/^rotate\(2\./);
        expect(screen.getByTestId('cake-measurement-height')).toHaveStyle({
            left: '400px',
            top: '300px',
            width: '16px',
            height: '600px',
        });
        expect((screen.getByTestId('cake-measurement-height').firstElementChild as HTMLElement).style.transform)
            .toMatch(/^rotate\(88\./);
        expect(screen.getByText('Flower').parentElement).toHaveStyle({
            left: '80px',
            top: '100px',
            width: '64px',
            height: '80px',
        });
    });

    it('renders fresh priced-element size lines instead of priced-element bboxes', () => {
        const analysisResult = {
            cake_measurements: {
                diameter: {
                    start: { x: 100, y: 500 },
                    end: { x: 900, y: 500 },
                },
                height: {
                    start: { x: 500, y: 300 },
                    end: { x: 500, y: 800 },
                },
            },
            main_toppers: [{
                description: 'Number candle',
                size_line: {
                    start: { x: 600, y: 200 },
                    end: { x: 650, y: 400 },
                },
            }],
            support_elements: [],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={400}
                imageHeight={533}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
            />
        );

        expect(screen.getByTestId('element-size-line-topper-0')).toHaveStyle({
            left: '600px',
            top: '200px',
            width: '50px',
            height: '200px',
        });
        expect(screen.getByText('Number candle')).toBeInTheDocument();
        expect(screen.queryByText('Topper 1')).not.toBeInTheDocument();
    });

    it('renders integrated bbox rows and [y, x] geometry on the storefront overlay', () => {
        const analysisResult = {
            geometry: {
                geometry_version: 'integrated_bbox_v1',
                cake_diameter_line: { start: [256, 290], end: [256, 915] },
                cake_height_line: { start: [256, 602], end: [805, 602] },
            },
            main_toppers: [{
                description: 'Chocolate rosettes',
                box_2d: [134, 305, 452, 903],
                bbox_confidence: 0.95,
            }],
            support_elements: [{
                description: 'Chocolate sprinkles',
                box_2d: [267, 497, 461, 712],
                bbox_confidence: 0.9,
            }],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1200}
                imageHeight={900}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
            />
        );

        expect(screen.getByTestId('cake-measurement-diameter')).toHaveStyle({
            left: '290px', top: '256px', width: '625px', height: '0px',
        });
        expect(screen.getByTestId('cake-measurement-height')).toHaveStyle({
            left: '602px', top: '256px', width: '0px', height: '549px',
        });
        expect(screen.getByText('Chocolate rosettes').parentElement).toHaveStyle({
            left: '305px', top: '134px', width: '598px', height: '318px',
        });
        expect(screen.getByText('Chocolate rosettes')).toHaveClass('text-[9px]');
        expect(screen.getByText('95%')).toHaveClass('text-[7px]');
        expect(screen.getByText('Chocolate sprinkles').parentElement).toHaveStyle({
            left: '497px', top: '267px', width: '215px', height: '194px',
        });
    });

    it('renders each per-quantity integrated bbox independently', () => {
        const analysisResult = {
            geometry: {
                geometry_version: 'integrated_bbox_v1',
                cake_diameter_line: { start: [256, 290], end: [256, 915] },
                cake_height_line: { start: [256, 602], end: [805, 602] },
            },
            main_toppers: [{
                description: 'Gemstone',
                box_2d: [[100, 100, 200, 200], [300, 300, 400, 400]],
                bbox_confidence: [0.95, 0.9],
            }],
            support_elements: [],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1200}
                imageHeight={900}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
            />
        );

        expect(screen.getByText('Gemstone 1')).toBeInTheDocument();
        expect(screen.getByText('Gemstone 2')).toBeInTheDocument();
        expect(screen.getByText('Gemstone 1').parentElement).toHaveStyle({
            left: '100px', top: '100px', width: '100px', height: '100px',
        });
        expect(screen.getByText('Gemstone 2').parentElement).toHaveStyle({
            left: '300px', top: '300px', width: '100px', height: '100px',
        });
    });

    it('can hide cake diameter and height lines while retaining detected boxes', () => {
        const analysisResult = {
            geometry: {
                geometry_version: 'integrated_bbox_v1',
                cake_diameter_line: { start: [256, 290], end: [256, 915] },
                cake_height_line: { start: [256, 602], end: [805, 602] },
            },
            main_toppers: [{
                description: 'Chocolate rosettes',
                box_2d: [134, 305, 452, 903],
                bbox_confidence: 0.95,
            }],
            support_elements: [],
            cake_messages: [],
        } as unknown as HybridAnalysisResult;

        render(
            <BoundingBoxOverlay
                analysisResult={analysisResult}
                imageWidth={1200}
                imageHeight={900}
                containerWidth={1000}
                containerHeight={1000}
                useTopLeftOrigin
                showCakeMeasurementLines={false}
            />
        );

        expect(screen.queryByTestId('cake-measurement-diameter')).not.toBeInTheDocument();
        expect(screen.queryByTestId('cake-measurement-height')).not.toBeInTheDocument();
        expect(screen.getByText('Chocolate rosettes').parentElement).toHaveStyle({
            left: '305px', top: '134px', width: '598px', height: '318px',
        });
    });
});
