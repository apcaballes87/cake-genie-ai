import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CUSTOMER_CHAT_IMAGE_COMPRESSION_OPTIONS,
    getCustomerChatImageExtension,
    prepareCustomerChatImage,
} from './customerChatImage';

const { compressImageMock } = vi.hoisted(() => ({
    compressImageMock: vi.fn(),
}));

vi.mock('@/lib/utils/imageOptimization', () => ({
    compressImage: compressImageMock,
}));

describe('customer chat image preparation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('compresses customer-chat images before they are uploaded', async () => {
        const originalFile = new File(['original'], 'cake-photo.jpg', { type: 'image/jpeg' });
        const compressedFile = new File(['compressed'], 'cake-photo.webp', { type: 'image/webp' });
        compressImageMock.mockResolvedValue(compressedFile);

        await expect(prepareCustomerChatImage(originalFile)).resolves.toBe(compressedFile);
        expect(compressImageMock).toHaveBeenCalledWith(originalFile, CUSTOMER_CHAT_IMAGE_COMPRESSION_OPTIONS);
    });

    it('uses the actual output MIME type for the storage extension', () => {
        expect(getCustomerChatImageExtension(new File(['image'], 'cake.jpg', { type: 'image/webp' }))).toBe('webp');
        expect(getCustomerChatImageExtension(new File(['image'], 'cake.jpeg', { type: 'image/jpeg' }))).toBe('jpg');
    });
});
