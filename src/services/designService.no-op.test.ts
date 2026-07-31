import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildAiChatImagePrompt } from '@/app/customizing/aiChatImagePrompt';
import type { CakeInfoUI, HybridAnalysisResult, MainTopperUI } from '@/types';
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

    it('preserves the reference-only edible-photo AI-chat prompt through image-edit filtering', async () => {
        vi.mocked(geminiService.editCakeImage).mockResolvedValueOnce('edible-photo-replacement');

        await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: {
                ...mockAnalysisResult,
                main_toppers: [{
                    type: 'edible_photo_top',
                    description: 'Lightning McQueen character edible photo print',
                    quantity: 1,
                    size: 'large',
                    group_id: 'lightning-mcqueen',
                    classification: 'hero',
                }],
            } as HybridAnalysisResult,
            cakeInfo: {
                type: '1 Tier',
                flavors: ['Chocolate Cake'],
                size: '8x8',
                thickness: '4 in',
            } as CakeInfoUI,
            mainToppers: [{
                id: 'edible-photo-top',
                type: 'edible_photo_top',
                original_type: 'edible_photo_top',
                description: 'Lightning McQueen character edible photo print',
                quantity: 1,
                size: 'large',
                group_id: 'lightning-mcqueen',
                classification: 'hero',
                isEnabled: true,
                price: 200,
            }] as MainTopperUI[],
            supportElements: [],
            cakeMessages: [],
            icingDesign: mockAnalysisResult.icing_design,
            additionalInstructions: '[USER REQUEST]: Change the Edible Photo to the uploaded photo',
            threeTierReferenceImage: null,
            traceId: 'edible-photo-reference-trace',
            requestSource: 'ai-chat-image-edit',
            promptGenerator: buildAiChatImagePrompt,
            referenceImages: [{
                label: 'Chat reference 1',
                targetDescription: 'blue mcqueen.jpg',
                targetType: 'design reference',
                image: { data: 'reference-base64', mimeType: 'image/jpeg' },
            }],
        });

        const [prompt, , , , , , preferredModel] =
            vi.mocked(geminiService.editCakeImage).mock.calls[0];

        expect(prompt).toContain('- Change the image on the top cake to this uploaded image.');
        expect(prompt).toContain('- Retain the rest of the design exactly as it is.');
        expect(prompt).toContain('Chat reference 1');
        expect(prompt).not.toContain('No changes were requested');
        expect(preferredModel).toBe('gemini-3.1-flash-lite-image');
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
                bbox: {
                    x: 110,
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

    it('targets every matching grouped decor instance without a fabricated region', async () => {
        (geminiService.editCakeImage as any).mockResolvedValueOnce('grouped-decor-image');

        await updateDesign({
            originalImageData: mockOriginalImage,
            analysisResult: mockAnalysisResult,
            cakeInfo: {
                type: '1 Tier',
                flavors: ['Chocolate Cake'],
                size: '6" Round',
                thickness: '3 in',
            },
            mainToppers: [{
                id: 'topper-group-1',
                type: 'edible_flowers',
                original_type: 'edible_flowers',
                description: 'blue flower toppers',
                quantity: 3,
                size: 'small',
                material: 'gumpaste',
                group_id: 'blue_flowers',
                classification: 'hero',
                color: '#000000',
                original_color: '#0000FF',
                isEnabled: true,
                price: 0,
                bbox: {
                    x: -20,
                    y: 140,
                    width: 60,
                    height: 60,
                    confidence: 0.95,
                },
            }],
            supportElements: [{
                id: 'support-group-1',
                type: 'edible_flowers',
                original_type: 'edible_flowers',
                description: 'red rose flowers',
                quantity: 4,
                size: 'medium',
                material: 'gumpaste',
                group_id: 'red_roses',
                color: '#000000',
                original_color: '#8B0000',
                isEnabled: true,
                price: 0,
                x: 0,
                y: 0,
                bbox: {
                    x: -20,
                    y: 140,
                    width: 60,
                    height: 60,
                    confidence: 0.95,
                },
            }, {
                id: 'support-group-2',
                type: 'dragees',
                original_type: 'dragees',
                description: 'gold bead accents',
                quantity: 5,
                size: 'small',
                material: 'sugar pearls',
                group_id: 'gold_beads',
                isEnabled: false,
                price: 0,
            }],
            cakeMessages: [],
            icingDesign: mockAnalysisResult.icing_design,
            additionalInstructions: '',
            threeTierReferenceImage: null,
            traceId: 'grouped-decor-trace',
        });

        const prompt = vi.mocked(geminiService.editCakeImage).mock.calls[0]?.[0];

        expect(prompt).toContain('For all matching main toppers "blue flower toppers" throughout the cake: Apply every listed change to every matching instance. recolor all matching instances to **Black (#000000)**');
        expect(prompt).toContain('For all matching support elements "red rose flowers" throughout the cake: Apply every listed change to every matching instance. recolor all matching instances to **Black (#000000)**');
        expect(prompt).toContain('Remove all matching support elements "gold bead accents" throughout the cake');
        expect(prompt).not.toContain('middle-center area of the cake');
        expect(prompt).not.toContain('Keep the edit tightly confined to that localized region');
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
