import { fileToBase64 } from '@/services/geminiService';
import { compressImage } from '@/lib/utils/imageOptimization';

const AI_CHAT_REFERENCE_IMAGE_COMPRESSION = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: 'image/webp',
} as const;

export async function prepareAiChatReferenceImage(file: File): Promise<{ fileName: string; image: { data: string; mimeType: string } }> {
    const preparedFile = await compressImage(file, AI_CHAT_REFERENCE_IMAGE_COMPRESSION);
    const image = await fileToBase64(preparedFile);

    return {
        fileName: file.name,
        image,
    };
}
