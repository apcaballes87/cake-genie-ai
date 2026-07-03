import { describe, expect, it, vi, beforeEach } from 'vitest';
import { prepareAiChatReferenceImage } from './aiChatReferenceImage';

const { compressImageMock, fileToBase64Mock } = vi.hoisted(() => ({
    compressImageMock: vi.fn(),
    fileToBase64Mock: vi.fn(),
}));

vi.mock('@/lib/utils/imageOptimization', () => ({
    compressImage: compressImageMock,
}));

vi.mock('@/services/geminiService', () => ({
    fileToBase64: fileToBase64Mock,
}));

describe('prepareAiChatReferenceImage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('compresses the uploaded reference image before converting it to base64', async () => {
        const originalFile = new File(['original-image'], 'edible-photo.jpg', { type: 'image/jpeg' });
        const compressedFile = new File(['compressed-image'], 'edible-photo.webp', { type: 'image/webp' });

        compressImageMock.mockResolvedValue(compressedFile);
        fileToBase64Mock.mockResolvedValue({
            data: 'compressed-base64',
            mimeType: 'image/webp',
        });

        const result = await prepareAiChatReferenceImage(originalFile);

        expect(compressImageMock).toHaveBeenCalledWith(originalFile, {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            fileType: 'image/webp',
        });
        expect(fileToBase64Mock).toHaveBeenCalledWith(compressedFile);
        expect(result).toEqual({
            fileName: 'edible-photo.jpg',
            image: {
                data: 'compressed-base64',
                mimeType: 'image/webp',
            },
        });
    });
});
