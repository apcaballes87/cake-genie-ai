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

function responseFor(bytes: Uint8Array, robotsTag: string): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'max-age=31536000',
      'x-robots-tag': robotsTag,
    },
  });
}

function makeClient() {
  const update = vi.fn().mockResolvedValue({ error: null });
  const client = {
    storage: { from: vi.fn(() => ({ update })) },
  } as unknown as StorageUpdateClient;
  return { client, update };
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
    const fetchImpl = vi.fn().mockResolvedValue(responseFor(bytes, 'none'));
    const { client, update } = makeClient();

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: false,
      fetchImpl,
    });

    expect(result).toMatchObject({ status: 'dry-run', priorRobotsTag: 'none' });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the same path and verifies unchanged bytes and dimensions', async () => {
    const bytes = await makeWebp();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(responseFor(bytes, 'none'))
      .mockResolvedValueOnce(responseFor(bytes, 'all'));
    const { client, update } = makeClient();

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl,
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
    const fetchImpl = vi.fn().mockResolvedValue(responseFor(bytes, 'all'));
    const { client, update } = makeClient();

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl,
    });

    expect(result.status).toBe('already-eligible');
    expect(update).not.toHaveBeenCalled();
  });

  it('fails when a storage rewrite changes the image bytes', async () => {
    const before = await makeWebp('#ff00ff');
    const after = await makeWebp('#00ffff');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(responseFor(before, 'none'))
      .mockResolvedValueOnce(responseFor(after, 'all'));
    const { client } = makeClient();

    await expect(ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl,
    })).rejects.toThrow('Byte hash changed');
  });

  it('reports external images without attempting an update', async () => {
    const { client, update } = makeClient();
    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: 'https://images.example.com/cake.webp',
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl: vi.fn(),
    });

    expect(result.status).toBe('external-skipped');
    expect(update).not.toHaveBeenCalled();
  });
});
