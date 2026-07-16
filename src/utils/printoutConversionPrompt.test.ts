import { describe, expect, it } from 'vitest';
import type { MainTopperUI } from '@/types';
import {
    buildEdibleToPrintoutInstruction,
    buildPrintoutConversionDetail,
    getPrintoutConversionTargets,
} from './printoutConversionPrompt';

const makeTopper = (overrides: Partial<MainTopperUI> = {}): MainTopperUI => ({
    id: 'topper-1',
    type: 'edible_3d_complex',
    original_type: 'edible_3d_complex',
    description: 'blue dinosaur topper',
    size: 'medium',
    quantity: 1,
    group_id: 'dinosaur',
    classification: 'hero',
    isEnabled: true,
    price: 0,
    ...overrides,
});

describe('printout conversion prompts', () => {
    it('describes an edible 3D topper as a specific flat cardboard conversion', () => {
        const prompt = buildEdibleToPrintoutInstruction({
            description: 'blue dinosaur topper',
            originalType: 'edible_3d_complex',
        });

        expect(prompt).toContain('only the existing complex 3D edible/gumpaste topper identified as "blue dinosaur topper"');
        expect(prompt).toContain('flat, cartoon-style printable cardboard cutout');
        expect(prompt).toContain('bright flat colors, clear black vector-style outlines');
        expect(prompt).toContain('thick, solid white die-cut border');
        expect(prompt).toContain('Do not change any other topper');
        expect(prompt).toContain('accurate cast shadows on the frosting');
        expect(prompt).toContain('Do NOT leave any 3D edible/gumpaste volume');
    });

    it('finds edible 3D conversion targets and ignores disabled or already-printout toppers', () => {
        const targets = getPrintoutConversionTargets('change the edible toppers to printout cardboard cutouts', [
            makeTopper(),
            makeTopper({ id: 'topper-2', description: 'pink bear', original_type: 'edible_3d_ordinary' }),
            makeTopper({ id: 'topper-3', description: 'already printed', type: 'printout' }),
            makeTopper({ id: 'topper-4', description: 'disabled dinosaur', isEnabled: false }),
        ]);

        expect(targets.map((topper) => topper.description)).toEqual(['blue dinosaur topper', 'pink bear']);
    });

    it('adds the analyzed target location to the conversion detail', () => {
        const detail = buildPrintoutConversionDetail(makeTopper({ x: 140, y: 140 }));

        expect(detail).toContain('blue dinosaur topper');
        expect(detail).toContain('upper-right area of the cake');
        expect(detail).toContain('Keep the edit tightly confined to that localized region');
    });
});
