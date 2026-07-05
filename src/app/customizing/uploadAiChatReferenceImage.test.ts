import { describe, expect, it, vi } from 'vitest';
import { uploadAiChatReferenceImage } from './uploadAiChatReferenceImage';

describe('uploadAiChatReferenceImage', () => {
  it('uploads the compressed AI chat attachment to the cakegenie bucket and returns the public URL', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/customizations/ai-chat-references/user-1/reference.webp' },
    });

    const supabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload,
          getPublicUrl,
        }),
      },
    } as never;

    const result = await uploadAiChatReferenceImage(supabase, {
      base64Data: Buffer.from('webp-binary').toString('base64'),
      ownerId: 'user-1',
    });

    expect(result).toBe('https://cdn.example.com/customizations/ai-chat-references/user-1/reference.webp');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0]).toMatch(/^customizations\/ai-chat-references\/user-1\/.+\.webp$/);
    expect(upload.mock.calls[0]?.[2]).toMatchObject({ contentType: 'image/webp', upsert: false });
    expect(getPublicUrl).toHaveBeenCalledWith(expect.stringMatching(/^customizations\/ai-chat-references\/user-1\/.+\.webp$/));
  });
});
