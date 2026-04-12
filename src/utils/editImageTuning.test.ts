import { describe, expect, it } from 'vitest';
import type { MainTopperUI, SupportElementUI } from '@/types';
import { buildDecorLocalizationHint, getEditImageCompressionOptions } from './editImageTuning';

const createTopper = (overrides: Partial<MainTopperUI> = {}): MainTopperUI => ({
    id: 'topper-1',
    isEnabled: true,
    price: 0,
    type: 'printout',
    original_type: 'printout',
    description: 'Character topper',
    size: 'medium',
    quantity: 1,
    group_id: 'group-1',
    classification: 'hero',
    x: 0,
    y: 0,
    ...overrides,
});

const createSupportElement = (overrides: Partial<SupportElementUI> = {}): SupportElementUI => ({
    id: 'element-1',
    isEnabled: true,
    price: 0,
    type: 'sprinkles',
    original_type: 'sprinkles',
    description: 'Sprinkles',
    size: 'small',
    group_id: 'group-1',
    classification: 'support',
    x: 0,
    y: 0,
    ...overrides,
});

describe('editImageTuning', () => {
    it('builds an upper-center localization hint from bbox data', () => {
        const hint = buildDecorLocalizationHint({
            bbox: {
                x: -20,
                y: 140,
                width: 60,
                height: 60,
                confidence: 0.92,
            },
        });

        expect(hint).toContain('upper-center area of the cake');
        expect(hint).toContain('Keep the edit tightly confined');
    });

    it('uses higher detail compression for decor-targeted edits', () => {
        const options = getEditImageCompressionOptions({
            prompt: 'Convert the topper to a printout',
            mainToppers: [createTopper({ type: 'printout', original_type: 'toy' })],
            supportElements: [],
        });

        expect(options).toMatchObject({
            maxSizeMB: 1.4,
            maxWidthOrHeight: 1600,
            fileType: 'image/jpeg',
        });
    });

    it('keeps default compression for broad non-decor edits', () => {
        const options = getEditImageCompressionOptions({
            prompt: 'Make the cake pink',
            mainToppers: [createTopper()],
            supportElements: [createSupportElement()],
        });

        expect(options).toMatchObject({
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1024,
            fileType: 'image/jpeg',
        });
    });
});
