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

    it('preserves a blank placeholder message and skips blank new-message prompts', async () => {
        (geminiService.editCakeImage as any).mockResolvedValueOnce('placeholder-preserved-image');

        const originalMessage = {
            type: 'icing_script',
            text: 'Happy Birthday',
            position: 'side',
            color: '#000000',
        };

        const result = await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: {
                ...mockAnalysisResult,
                cake_messages: [originalMessage],
            } as any,
            cakeInfo: { type: '1 Tier', flavor: ['Chocolate Cake'], size: '6" Round', thickness: 'Standard' } as any,
            mainToppers: [],
            supportElements: [],
            cakeMessages: [
                {
                    id: 'message-1',
                    type: 'icing_script',
                    text: '',
                    position: 'side',
                    color: '#000000',
                    originalMessage,
                    isPlaceholder: true,
                    isEnabled: true,
                    price: 0,
                },
                {
                    id: 'message-2',
                    type: 'gumpaste_letters',
                    text: '',
                    position: 'top',
                    color: '#000000',
                    isEnabled: true,
                    price: 0,
                },
            ] as any,
            icingDesign: { ...mockAnalysisResult.icing_design, colors: { side: '#FF0000' } },
            additionalInstructions: '',
            threeTierReferenceImage: null,
            traceId: 'placeholder-message-trace',
        });

        const [prompt] = (geminiService.editCakeImage as any).mock.calls[0];
        expect(prompt).toContain('Preserve the existing text/message');
        expect(prompt).not.toContain('Write ""');
        expect(result.image).toBe('placeholder-preserved-image');
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
                y: 140,
                bbox: {
                    x: -20,
                    y: 140,
                    width: 60,
                    height: 60,
                    confidence: 0.95,
                },
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
        expect(prompt).toContain('upper-center area of the cake');
        expect(systemInstruction).toContain('TOY TO PRINTOUT CONVERSIONS');
    });

    it('uses the cardboard cutout prompt when converting an edible 3D topper to printout', async () => {
        (geminiService.editCakeImage as any).mockResolvedValueOnce('edible-to-printout-image');

        await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: {
                ...mockAnalysisResult,
                main_toppers: [{
                    type: 'edible_3d_complex',
                    description: 'blue dinosaur topper',
                    quantity: 1,
                    size: 'medium',
                    material: 'edible',
                    group_id: 'dinosaur-1',
                    classification: 'hero',
                }],
            } as any,
            cakeInfo: { type: '1 Tier', flavor: ['Chocolate Cake'], size: '6" Round', thickness: 'Standard' } as any,
            mainToppers: [{
                id: 'topper-1',
                type: 'printout',
                original_type: 'edible_3d_complex',
                description: 'blue dinosaur topper',
                quantity: 1,
                size: 'medium',
                material: 'edible',
                group_id: 'dinosaur-1',
                classification: 'hero',
                isEnabled: true,
                price: 0,
                x: 140,
                y: 140,
            }] as any,
            supportElements: [],
            cakeMessages: [],
            icingDesign: mockAnalysisResult.icing_design,
            additionalInstructions: '',
            threeTierReferenceImage: null,
            traceId: 'edible-printout-trace',
        });

        const [prompt] = (geminiService.editCakeImage as any).mock.calls[0];

        expect(prompt).toContain('blue dinosaur topper');
        expect(prompt).toContain('flat, cartoon-style printable cardboard cutout');
        expect(prompt).toContain('thick, solid white die-cut border');
        expect(prompt).toContain('upper-right area of the cake');
        expect(prompt).toContain('Do not change any other topper');
        const [, , , , , systemInstruction] = (geminiService.editCakeImage as any).mock.calls[0];
        expect(systemInstruction).toContain('EDIBLE 3D TO PRINTOUT CONVERSIONS');
    });

    it('passes topper replacement images through with stable reference labels', async () => {
        (geminiService.editCakeImage as any).mockResolvedValueOnce('replacement-image-result');

        await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: {
                ...mockAnalysisResult,
                main_toppers: [{
                    type: 'printout',
                    description: 'graduation topper',
                    quantity: 1,
                    size: 'medium',
                    material: 'paper',
                    group_id: 'topper-1',
                    classification: 'hero',
                }],
            } as any,
            cakeInfo: { type: '1 Tier', flavor: ['Chocolate Cake'], size: '6" Round', thickness: 'Standard' } as any,
            mainToppers: [{
                id: 'topper-1',
                type: 'printout',
                original_type: 'printout',
                description: 'graduation topper',
                quantity: 1,
                size: 'medium',
                material: 'paper',
                group_id: 'topper-1',
                classification: 'hero',
                isEnabled: true,
                price: 0,
                replacementImage: {
                    data: 'replacement-base64',
                    mimeType: 'image/png',
                },
            }] as any,
            supportElements: [],
            cakeMessages: [],
            icingDesign: mockAnalysisResult.icing_design,
            additionalInstructions: '',
            threeTierReferenceImage: null,
            traceId: 'replacement-image-trace',
        });

        const [prompt, , , , , , , , , referenceImages] = (geminiService.editCakeImage as any).mock.calls[0];

        expect(prompt).toContain('### **Replacement Reference Images**');
        expect(prompt).toContain('Replacement reference 1');
        expect(prompt).toContain('replace its image with Replacement reference 1');
        expect(referenceImages).toEqual([
            {
                label: 'Replacement reference 1',
                targetDescription: 'graduation topper',
                targetType: 'main topper',
                image: {
                    data: 'replacement-base64',
                    mimeType: 'image/png',
                },
            },
        ]);
    });
});
