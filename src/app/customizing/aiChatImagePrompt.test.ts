import { describe, expect, it } from 'vitest';
import type { CakeInfoUI, IcingDesignUI, MainTopperUI } from '@/types';
import {
    buildAiChatImagePrompt,
    buildAiChatVisualChangeSummary,
    buildDirectEdiblePhotoReplacementPrompt,
} from './aiChatImagePrompt';

describe('buildAiChatImagePrompt', () => {
    it('adds target-specific edible topper conversion details to an AI chat image request', () => {
        const cakeInfo: CakeInfoUI = {
            type: '1 Tier',
            thickness: '3 in',
            size: '6" Round',
            flavors: ['Chocolate Cake'],
        };
        const icingDesign: IcingDesignUI = {
            base: 'soft_icing',
            color_type: 'single',
            colors: { side: '#FFFFFF' },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false,
            dripPrice: 0,
            gumpasteBaseBoardPrice: 0,
        };
        const mainToppers: MainTopperUI[] = [
            {
                id: 'topper-1',
                type: 'printout',
                original_type: 'edible_3d_complex',
                description: 'blue dinosaur topper',
                size: 'medium',
                quantity: 1,
                group_id: 'dinosaur',
                classification: 'hero',
                isEnabled: true,
                price: 0,
                x: -140,
                y: 140,
                bbox: {
                    x: -170,
                    y: 140,
                    width: 60,
                    height: 60,
                    confidence: 0.95,
                },
            },
            {
                id: 'topper-2',
                type: 'printout',
                original_type: 'edible_3d_ordinary',
                description: 'pink bear topper',
                size: 'medium',
                quantity: 1,
                group_id: 'bear',
                classification: 'hero',
                isEnabled: true,
                price: 0,
                x: 140,
                y: 140,
                bbox: {
                    x: 110,
                    y: 140,
                    width: 60,
                    height: 60,
                    confidence: 0.95,
                },
            },
        ];

        const prompt = buildAiChatImagePrompt(
            null,
            cakeInfo,
            mainToppers,
            [],
            [],
            icingDesign,
            '[USER REQUEST]: change the edible toppers to printout cardboard cutouts',
        );

        expect(prompt).toContain('blue dinosaur topper');
        expect(prompt).toContain('pink bear topper');
        expect(prompt).toContain('upper-left area of the cake');
        expect(prompt).toContain('upper-right area of the cake');
        expect(prompt).toContain('flat, cartoon-style printable cardboard cutout');
        expect(prompt).toContain('Preserve the final **cake size** as "6" Round".');
    });

    it('carries verified fondant option changes into the visual edit prompt', () => {
        const cakeInfo: CakeInfoUI = {
            type: '1 Tier Fondant',
            thickness: '5 in',
            size: '6" Round Fondant',
            flavors: ['Ube Cake'],
        };
        const icingDesign: IcingDesignUI = {
            base: 'fondant',
            color_type: 'single',
            colors: { side: '#FFFFFF', top: '#FFFFFF' },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false,
            dripPrice: 0,
            gumpasteBaseBoardPrice: 0,
        };
        const summary = buildAiChatVisualChangeSummary({
            changedPaths: ['cakeInfo.type', 'cakeInfo.size', 'cakeInfo.thickness', 'icingDesign.base'],
            cakeInfo,
            icingDesign,
            mainToppers: [],
            supportElements: [],
            cakeMessages: [],
        });

        const prompt = buildAiChatImagePrompt(
            null,
            cakeInfo,
            [],
            [],
            [],
            icingDesign,
            `[USER REQUEST]: please change to fondant\n[NORMALIZED CHANGES]:\n${summary}`,
        );

        expect(summary).toContain('1 Tier Fondant, 6" Round Fondant, 5 in');
        expect(summary).toContain('Use fondant');
        expect(prompt).toContain('Verified option changes (authoritative)');
        expect(prompt).toContain('Use fondant');
    });

    it('uses a concise prompt for replacing an edible photo with an uploaded image', () => {
        const prompt = buildAiChatImagePrompt(
            null,
            {
                type: '1 Tier',
                thickness: '3 in',
                size: '8x8',
                flavors: ['Chocolate Cake'],
            },
            [{
                id: 'edible-photo-top',
                type: 'edible_photo_top',
                original_type: 'edible_photo_top',
                description: 'Lightning McQueen character edible photo print',
                size: 'large',
                quantity: 1,
                group_id: 'lightning_mcqueen',
                classification: 'hero',
                isEnabled: true,
                price: 200,
            }],
            [],
            [],
            {
                base: 'soft_icing',
                color_type: 'single',
                colors: { side: '#FFFFFF', top: '#FFFFFF' },
                border_top: false,
                border_base: false,
                drip: false,
                gumpasteBaseBoard: false,
                dripPrice: 0,
                gumpasteBaseBoardPrice: 0,
            },
            '[USER REQUEST]: Change the Edible Photo to the uploaded photo.\n[NORMALIZED CHANGES]:\n- Final enabled main toppers: edible-photo-top',
        );

        expect(prompt).toBe(`---
### **List of Changes to Apply**
---

- Change the image on the top cake to this uploaded image.
- Retain the rest of the design exactly as it is.`);
    });

    it('provides the same concise prompt for the direct edible-photo quick action', () => {
        expect(buildDirectEdiblePhotoReplacementPrompt(
            null,
            {} as CakeInfoUI,
            [],
            [],
            [],
            {} as IcingDesignUI,
            '',
        )).toBe(`---
### **List of Changes to Apply**
---

- Change the image on the top cake to this uploaded image.
- Retain the rest of the design exactly as it is.`);
    });
});
