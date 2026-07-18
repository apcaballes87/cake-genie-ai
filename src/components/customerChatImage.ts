import { compressImage } from '@/lib/utils/imageOptimization';

export const CUSTOMER_CHAT_IMAGE_COMPRESSION_OPTIONS = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.82,
} as const;

export function prepareCustomerChatImage(file: File): Promise<File> {
    return compressImage(file, CUSTOMER_CHAT_IMAGE_COMPRESSION_OPTIONS);
}

export function getCustomerChatImageExtension(file: File): string {
    const extensionByMimeType: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };

    return extensionByMimeType[file.type] || file.name.split('.').pop()?.toLowerCase() || 'webp';
}
