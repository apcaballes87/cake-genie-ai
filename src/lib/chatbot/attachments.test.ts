import { describe, expect, it } from 'vitest';

import { getChatImageObjectPath, isOwnedCustomerAttachmentPath, isStaffAttachmentPath } from './attachments';

describe('getChatImageObjectPath', () => {
  it('extracts legacy public chat image paths for private signed access', () => {
    expect(getChatImageObjectPath('https://example.supabase.co/storage/v1/object/public/chat-images/messages/photo.webp'))
      .toBe('messages/photo.webp');
  });

  it('accepts stored paths and rejects unrelated URLs or traversal', () => {
    expect(getChatImageObjectPath('user/conversation/photo.webp')).toBe('user/conversation/photo.webp');
    expect(getChatImageObjectPath('https://evil.example/photo.webp')).toBeNull();
    expect(getChatImageObjectPath('../secret')).toBeNull();
  });

  it('requires exact owner/conversation attachment paths', () => {
    const id = '8fb19d6e-c2cd-4a30-a1fc-153dbe918a11';
    const conversation = 'bdc11b43-8d6d-48b4-94f0-daf8d1117b38';
    const file = '50baf624-1f20-42a3-91ed-b2ddaaee2055.webp';
    expect(isOwnedCustomerAttachmentPath(`${id}/${conversation}/${file}`, id, conversation)).toBe(true);
    expect(isOwnedCustomerAttachmentPath(`${id}/${conversation}/nested/${file}`, id, conversation)).toBe(false);
    expect(isOwnedCustomerAttachmentPath(`${id}/${conversation}/photo.gif`, id, conversation)).toBe(false);
    expect(isStaffAttachmentPath(`staff/${conversation}/${file}`, conversation)).toBe(true);
  });
});
