import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HybridAnalysisResult } from '@/types';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';

describe('BoundingBoxOverlay', () => {
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
        expect(screen.getByText('Chocolate sprinkles').parentElement).toHaveStyle({
            left: '497px', top: '267px', width: '215px', height: '194px',
        });
    });
});
