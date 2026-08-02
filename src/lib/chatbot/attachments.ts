const PUBLIC_CHAT_IMAGE_MARKERS = [
  '/storage/v1/object/public/chat-images/',
  '/storage/v1/object/sign/chat-images/',
];

export function getChatImageObjectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.includes('..') ? null : value;
  try {
    const url = new URL(value);
    const marker = PUBLIC_CHAT_IMAGE_MARKERS.find((candidate) => url.pathname.includes(candidate));
    if (!marker) return null;
    const encodedPath = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);
    const path = decodeURIComponent(encodedPath);
    return path && !path.includes('..') ? path : null;
  } catch {
    return null;
  }
}

export function isOwnedCustomerAttachmentPath(path: string, userId: string, conversationId: string): boolean {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escape(userId)}/${escape(conversationId)}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`, 'i').test(path);
}

export function isStaffAttachmentPath(path: string, conversationId: string): boolean {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^staff/${escape(conversationId)}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`, 'i').test(path);
}
