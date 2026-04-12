import { describe, expect, it, vi, beforeEach } from 'vitest';
import { updateDesign } from './designService';
import * as geminiService from './geminiService';

vi.mock('./geminiService', () => ({
    editCakeImage: vi.fn(),
    compressImage: vi.fn((data) => Promise.resolve(data)),
    validateCakeImage: vi.fn(),
}));

describe('designService: no-op fast path', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockOriginalImage = {
        data: 'base64-content',
        mimeType: 'image/png'
    };

    const mockAnalysisResult = {
        cakeType: '1 Tier',
        cakeThickness: 'Standard',
        cakeSize: '6" Round',
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
        icing_design: {
            base: 'soft_icing',
            color_type: 'single',
            colors: { side: '#FFFFFF' },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false
        }
    } as any;

    it('returns the original image immediately when no changes are detected', async () => {
        const result = await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: mockAnalysisResult,
            cakeInfo: { type: '1 Tier', flavor: ['Chocolate Cake'], size: '6" Round', thickness: 'Standard' } as any,
            mainToppers: [],
            supportElements: [],
            cakeMessages: [],
            icingDesign: mockAnalysisResult.icing_design,
            additionalInstructions: '',
            threeTierReferenceImage: null,
            traceId: 'test-trace',
        });

        // Should NOT call editCakeImage
        expect(geminiService.editCakeImage).not.toHaveBeenCalled();
        
        // Should return the original image data-uri
        expect(result.image).toBe(`data:${mockOriginalImage.mimeType};base64,${mockOriginalImage.data}`);
        expect(result.prompt).toContain('No changes were requested');
    });

    it('calls editCakeImage when there are changes', async () => {
        // editCakeImage returns a string (base64)
        (geminiService.editCakeImage as any).mockResolvedValueOnce('new-image-data-base64');

        const result = await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: mockAnalysisResult,
            cakeInfo: { type: '1 Tier', flavor: ['Chocolate Cake'], size: '6" Round', thickness: 'Standard' } as any,
            mainToppers: [],
            supportElements: [],
            cakeMessages: [],
            icingDesign: { ...mockAnalysisResult.icing_design, colors: { side: '#FF0000' } }, // Color change
            additionalInstructions: '',
            threeTierReferenceImage: null,
            traceId: 'test-trace',
        });

        // Should call editCakeImage
        expect(geminiService.editCakeImage).toHaveBeenCalled();
        expect(result.image).toBe('new-image-data-base64');
    });

    it('uses a strong object-replacement prompt when converting a toy topper to printout', async () => {
        (geminiService.editCakeImage as any).mockResolvedValueOnce('toy-to-printout-image');

        await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: {
                ...mockAnalysisResult,
                main_toppers: [{
                    type: 'toy',
                    description: 'paw patrol figure',
                    quantity: 1,
                    size: 'medium',
                    material: 'plastic',
                    group_id: 'toy-1',
                    classification: 'hero',
                }],
            } as any,
            cakeInfo: { type: '1 Tier', flavor: ['Chocolate Cake'], size: '6" Round', thickness: 'Standard' } as any,
            mainToppers: [{
                id: 'topper-1',
                type: 'printout',
                original_type: 'toy',
                description: 'paw patrol figure',
                quantity: 1,
                size: 'medium',
                material: 'plastic',
                group_id: 'toy-1',
                classification: 'hero',
                isEnabled: true,
                price: 0,
                x: 0,
                y: 0,
            }] as any,
            supportElements: [],
            cakeMessages: [],
            icingDesign: mockAnalysisResult.icing_design,
            additionalInstructions: '',
            threeTierReferenceImage: null,
            traceId: 'toy-printout-trace',
        });

        const [prompt, , , , , systemInstruction] = (geminiService.editCakeImage as any).mock.calls[0];

        expect(prompt).toContain('completely remove the existing 3D toy');
        expect(prompt).toContain('flat 2D printed paper cutout version of the same subject');
        expect(prompt).toContain('Do NOT leave any molded plastic seams');
        expect(systemInstruction).toContain('TOY TO PRINTOUT CONVERSIONS');
    });
});
