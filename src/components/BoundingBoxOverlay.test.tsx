import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HybridAnalysisResult } from '@/types';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';

describe('BoundingBoxOverlay', () => {
    it('scales raw coordinates within the rendered image and preserves crop offsets', () => {
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

        expect(screen.getByText('Cake').parentElement).toHaveStyle({
            left: '10px',
            top: '55px',
            width: '200px',
            height: '100px',
        });
        expect(screen.getByText('Beach bucket').parentElement).toHaveStyle({
            left: '110px',
            top: '80px',
            width: '50px',
            height: '40px',
        });
    });
});
