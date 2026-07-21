import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { uploadVariant } from './storage';

describe('uploadVariant', () => {
  it('makes generated public variants crawler eligible', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'variants/cake/800.webp' }, error: null });
    const client = {
      storage: {
        from: vi.fn(() => ({ upload })),
      },
    } as unknown as SupabaseClient;

    await uploadVariant(client, 'minimalist-cake-ffff', 800, Buffer.from('webp'));

    expect(upload).toHaveBeenCalledWith(
      'variants/minimalist-cake-ffff/800.webp',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
        headers: { 'x-robots-tag': 'all' },
      }),
    );
  });
});
