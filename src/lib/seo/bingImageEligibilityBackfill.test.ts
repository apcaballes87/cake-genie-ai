import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
  cacheControlMaxAge,
  ensurePublicImageEligibility,
  parseGenieStorageObjectUrl,
  type StorageUpdateClient,
} from './bingImageEligibilityBackfill';

const SUPABASE_ORIGIN = 'https://project.supabase.co';
const IMAGE_URL = `${SUPABASE_ORIGIN}/storage/v1/object/public/cakegenie/variants/minimalist-cake-ffff/800.webp`;

async function makeWebp(color = '#ff00ff'): Promise<Uint8Array> {
  return Uint8Array.from(await sharp({
    create: { width: 8, height: 6, channels: 3, background: color },
  }).webp().toBuffer());
}

function makeClient({
  beforeBytes,
  afterBytes = beforeBytes,
  initialRobotsTag = 'none',
  updatedRobotsTag = 'all',
}: {
  beforeBytes: Uint8Array;
  afterBytes?: Uint8Array;
  initialRobotsTag?: string;
  updatedRobotsTag?: string;
}) {
  let updated = false;
  const update = vi.fn().mockImplementation(async () => {
    updated = true;
    return { error: null };
  });
  const list = vi.fn().mockImplementation(async () => ({
    data: [{
      name: '800.webp',
      metadata: {
        mimetype: 'image/webp',
        cacheControl: 'max-age=31536000',
        xRobotsTag: updated ? updatedRobotsTag : initialRobotsTag,
      },
    }],
    error: null,
  }));
  const download = vi.fn().mockImplementation(async () => ({
    data: {
      type: 'image/webp',
      arrayBuffer: async () => Uint8Array.from(updated ? afterBytes : beforeBytes).buffer,
    } as Blob,
    error: null,
  }));
  const client = {
    storage: { from: vi.fn(() => ({ list, download, update })) },
  } as unknown as StorageUpdateClient;
  return { client, list, download, update };
}

describe('Bing image eligibility backfill', () => {
  it('accepts only the Genie public bucket and approved SEO object paths', () => {
    expect(parseGenieStorageObjectUrl(IMAGE_URL, SUPABASE_ORIGIN)).toMatchObject({
      bucket: 'cakegenie',
      objectPath: 'variants/minimalist-cake-ffff/800.webp',
      publicUrl: IMAGE_URL,
    });
    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/private/variants/cake/800.webp`,
      SUPABASE_ORIGIN,
    )).toBeNull();
    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/cakegenie/payment-proofs/proof.webp`,
      SUPABASE_ORIGIN,
    )).toBeNull();
    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/cakegenie/variants/%2E%2E/payment-proofs/proof.webp`,
      SUPABASE_ORIGIN,
    )).toBeNull();
    expect(parseGenieStorageObjectUrl(
      'https://images.example.com/cake.webp',
      SUPABASE_ORIGIN,
    )).toBeNull();
  });

  it('preserves a numeric cache max-age and safely falls back to zero', () => {
    expect(cacheControlMaxAge('public, max-age=86400, immutable')).toBe('86400');
    expect(cacheControlMaxAge('no-cache')).toBe('0');
    expect(cacheControlMaxAge(null)).toBe('0');
  });

  it('is dry-run by default and reports the current restrictive header', async () => {
    const bytes = await makeWebp();
    const { client, update } = makeClient({ beforeBytes: bytes });

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: false,
    });

    expect(result).toMatchObject({ status: 'dry-run', priorRobotsTag: 'none' });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the same path and verifies unchanged bytes and dimensions', async () => {
    const bytes = await makeWebp();
    const { client, update } = makeClient({ beforeBytes: bytes });

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
    });

    expect(result.status).toBe('updated');
    expect(update).toHaveBeenCalledWith(
      'variants/minimalist-cake-ffff/800.webp',
      expect.any(Uint8Array),
      {
        contentType: 'image/webp',
        cacheControl: '31536000',
        headers: { 'x-robots-tag': 'all' },
      },
    );
  });

  it('skips an object that is already eligible', async () => {
    const bytes = await makeWebp();
    const { client, update } = makeClient({ beforeBytes: bytes, initialRobotsTag: 'all' });

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
    });

    expect(result.status).toBe('already-eligible');
    expect(update).not.toHaveBeenCalled();
  });

  it('fails when a storage rewrite changes the image bytes', async () => {
    const before = await makeWebp('#ff00ff');
    const after = await makeWebp('#00ffff');
    const { client } = makeClient({ beforeBytes: before, afterBytes: after });

    await expect(ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
    })).rejects.toThrow('Byte hash changed');
  });

  it('reports external images without attempting an update', async () => {
    const { client, update } = makeClient({ beforeBytes: await makeWebp() });
    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: 'https://images.example.com/cake.webp',
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
    });

    expect(result.status).toBe('external-skipped');
    expect(update).not.toHaveBeenCalled();
  });
});
