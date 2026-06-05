import { describe, expect, it } from 'vitest';
import { getDesignAvailability, DesignData } from './availability';

describe('getDesignAvailability', () => {
    it('returns normal for cupcake types regardless of decorations', () => {
        const design: DesignData = {
            cakeType: 'cupcakes-printout-toppers',
            cakeSize: '2oz - 12 pieces',
            icingBase: 'soft_icing',
            drip: false,
            gumpasteBaseBoard: false,
            mainToppers: [],
            supportElements: [],
        };
        expect(getDesignAvailability(design)).toBe('normal');

        const complexDesign: DesignData = {
            cakeType: 'cupcakes-gumpaste-toppers-complex',
            cakeSize: '2oz - 12 pieces',
            icingBase: 'soft_icing',
            drip: true,
            gumpasteBaseBoard: true,
            mainToppers: [{ type: 'edible_3d_complex', description: 'detailed animal' }],
            supportElements: [{ type: 'sprinkles', description: 'rainbow sprinkles' }],
        };
        expect(getDesignAvailability(complexDesign)).toBe('normal');
    });

    it('returns rush for simple bento cakes', () => {
        const design: DesignData = {
            cakeType: 'Bento',
            cakeSize: '4" Round',
            icingBase: 'soft_icing',
            drip: false,
            gumpasteBaseBoard: false,
            mainToppers: [],
            supportElements: [],
        };
        expect(getDesignAvailability(design)).toBe('rush');
    });
});
