import { describe, expect, it } from 'vitest';
import { hasBoundingBoxData, needsCoordinateEnrichment } from './analysisUtils';
import type { HybridAnalysisResult } from '@/types';

describe('analysisUtils', () => {
    describe('hasBoundingBoxData', () => {
        const createBaseResult = (): HybridAnalysisResult => ({
            cakeType: '1 Tier',
            cakeThickness: '4 in',
            main_toppers: [],
            support_elements: [],
            cake_messages: [],
            icing_design: {
                base: 'soft_icing',
                color_type: 'single',
                colors: {},
                border_top: false,
                border_base: false,
                drip: false,
                gumpasteBaseBoard: false
            }
        });

        it('returns false for empty arrays', () => {
            const result = createBaseResult();
            expect(hasBoundingBoxData(result)).toBe(false);
        });

        it('returns false when no items have bbox data', () => {
            const result = createBaseResult();
            result.main_toppers = [{
                type: 'edible_3d_complex',
                description: 'test',
                size: 'medium',
                quantity: 1,
                group_id: '1',
                classification: 'hero'
            }];
            expect(hasBoundingBoxData(result)).toBe(false);
        });

        it('returns false when bbox data has 0 confidence', () => {
            const result = createBaseResult();
            result.main_toppers = [{
                type: 'edible_3d_complex',
                description: 'test',
                size: 'medium',
                quantity: 1,
                group_id: '1',
                classification: 'hero',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0 }
            }];
            expect(hasBoundingBoxData(result)).toBe(false);
        });

        it('returns true when a main topper has valid bbox data', () => {
            const result = createBaseResult();
            result.main_toppers = [{
                type: 'edible_3d_complex',
                description: 'test',
                size: 'medium',
                quantity: 1,
                group_id: '1',
                classification: 'hero',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0.8 }
            }];
            expect(hasBoundingBoxData(result)).toBe(true);
        });

        it('returns true when a support element has valid bbox data', () => {
            const result = createBaseResult();
            result.support_elements = [{
                type: 'edible_3d_support',
                description: 'test',
                size: 'medium',
                group_id: '1',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0.9 }
            }];
            expect(hasBoundingBoxData(result)).toBe(true);
        });

        it('returns true when a cake message has valid bbox data', () => {
            const result = createBaseResult();
            result.cake_messages = [{
                type: 'gumpaste_letters',
                text: 'test',
                position: 'top',
                color: 'black',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0.7 }
            }];
            expect(hasBoundingBoxData(result)).toBe(true);
        });
    });

    describe('needsCoordinateEnrichment', () => {
        const createBaseResult = (): HybridAnalysisResult => ({
            cakeType: '1 Tier',
            cakeThickness: '4 in',
            main_toppers: [],
            support_elements: [],
            cake_messages: [],
            icing_design: {
                base: 'soft_icing',
                color_type: 'single',
                colors: {},
                border_top: false,
                border_base: false,
                drip: false,
                gumpasteBaseBoard: false
            }
        });

        it('returns true when there are no items with bbox data', () => {
            const result = createBaseResult();
            // Since hasBoundingBoxData will return false, needsCoordinateEnrichment returns true
            expect(needsCoordinateEnrichment(result)).toBe(true);
        });

        it('returns true when a main topper is missing coordinates', () => {
            const result = createBaseResult();
            result.main_toppers = [{
                type: 'edible_3d_complex',
                description: 'test',
                size: 'medium',
                quantity: 1,
                group_id: '1',
                classification: 'hero',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0.8 },
                x: undefined, // Missing coordinate
                y: 10
            }];
            expect(needsCoordinateEnrichment(result)).toBe(true);
        });

        it('returns true when a support element is missing coordinates', () => {
            const result = createBaseResult();
            result.support_elements = [{
                type: 'edible_3d_support',
                description: 'test',
                size: 'medium',
                group_id: '1',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0.8 },
                x: 10,
                y: undefined // Missing coordinate
            }];
            expect(needsCoordinateEnrichment(result)).toBe(true);
        });

        it('returns true when a cake message is missing coordinates', () => {
            const result = createBaseResult();
            result.cake_messages = [{
                type: 'gumpaste_letters',
                text: 'test',
                position: 'top',
                color: 'black',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0.8 },
                // Missing both x and y
            }];
            expect(needsCoordinateEnrichment(result)).toBe(true);
        });

        it('returns false when all items have coordinates and bbox data is present', () => {
            const result = createBaseResult();
            result.main_toppers = [{
                type: 'edible_3d_complex',
                description: 'test',
                size: 'medium',
                quantity: 1,
                group_id: '1',
                classification: 'hero',
                bbox: { x: 0, y: 0, width: 10, height: 10, confidence: 0.8 },
                x: 10,
                y: 10
            }];
            expect(needsCoordinateEnrichment(result)).toBe(false);
        });
    });
});
