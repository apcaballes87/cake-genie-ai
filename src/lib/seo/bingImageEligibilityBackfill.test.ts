import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
  cacheControlMaxAge,
  ensurePublicImageEligibility,
  isPublicImageRobotsEligible,
  parseGenieStorageObjectUrl,
  readCanonicalPublicImageHeaders,
  waitForPublicImageEligibility,
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

function publicResponse(
  xRobotsTag: string | null,
  options: { status?: number; contentType?: string; cfCacheStatus?: string } = {},
): Response {
  const headers = new Headers({
    'content-type': options.contentType ?? 'image/webp',
    'content-range': 'bytes 0-0/100',
    'cache-control': 'public, max-age=31536000',
    'cf-cache-status': options.cfCacheStatus ?? 'HIT',
  });
  if (xRobotsTag) headers.set('x-robots-tag', xRobotsTag);

  return new Response(Uint8Array.from([0]), {
    status: options.status ?? 206,
    headers,
  });
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

  it('requires all without any conflicting restrictive directive', () => {
    expect(isPublicImageRobotsEligible('all')).toBe(true);
    expect(isPublicImageRobotsEligible('ALL')).toBe(true);
    expect(isPublicImageRobotsEligible('all, noimageindex')).toBe(false);
    expect(isPublicImageRobotsEligible('none, all')).toBe(false);
    expect(isPublicImageRobotsEligible(null)).toBe(false);
  });

  it('checks the exact canonical URL with a one-byte public GET', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(publicResponse('all'));

    const result = await readCanonicalPublicImageHeaders(IMAGE_URL, fetchImpl);

    expect(result).toMatchObject({
      url: IMAGE_URL,
      status: 206,
      xRobotsTag: 'all',
      eligible: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(IMAGE_URL, expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ range: 'bytes=0-0' }),
    }));
    expect(fetchImpl.mock.calls[0][0]).not.toContain('?');
  });

  it('reports internal-eligible but publicly blocked objects in dry-run mode', async () => {
    const bytes = await makeWebp();
    const { client, update } = makeClient({ beforeBytes: bytes, initialRobotsTag: 'all' });

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: false,
      fetchImpl: vi.fn().mockResolvedValue(publicResponse('none')),
    });

    expect(result).toMatchObject({
      status: 'public-blocked',
      priorRobotsTag: 'all',
      publicSnapshot: { eligible: false, xRobotsTag: 'none' },
    });
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
      fetchImpl: vi.fn().mockResolvedValue(publicResponse('none')),
    });

    expect(result.status).toBe('updated-pending-public');
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

  it('skips only when the canonical public GET is already eligible', async () => {
    const bytes = await makeWebp();
    const { client, update, list, download } = makeClient({ beforeBytes: bytes, initialRobotsTag: 'none' });

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl: vi.fn().mockResolvedValue(publicResponse('all')),
    });

    expect(result.status).toBe('already-eligible');
    expect(update).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it('polls blocked public GET responses until the canonical URL is eligible', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(publicResponse('none'))
      .mockResolvedValueOnce(publicResponse('all', { cfCacheStatus: 'MISS' }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const result = await waitForPublicImageEligibility({
      urls: [IMAGE_URL],
      fetchImpl,
      sleepImpl,
      timeoutMs: 15_000,
      intervalMs: 15_000,
      concurrency: 1,
    });

    expect(result).toMatchObject({ attempts: 2, blocked: [] });
    expect(result.eligible).toEqual([
      expect.objectContaining({ url: IMAGE_URL, eligible: true, cfCacheStatus: 'MISS' }),
    ]);
    expect(sleepImpl).toHaveBeenCalledWith(15_000);
  });

  it('hard-fails public verification when none remains after the timeout', async () => {
    const result = await waitForPublicImageEligibility({
      urls: [IMAGE_URL],
      fetchImpl: vi.fn().mockImplementation(async () => publicResponse('all, noimageindex')),
      sleepImpl: vi.fn().mockResolvedValue(undefined),
      timeoutMs: 15_000,
      intervalMs: 15_000,
      concurrency: 1,
    });

    expect(result.attempts).toBe(2);
    expect(result.eligible).toEqual([]);
    expect(result.blocked).toEqual([
      expect.objectContaining({
        url: IMAGE_URL,
        snapshot: expect.objectContaining({ eligible: false, xRobotsTag: 'all, noimageindex' }),
      }),
    ]);
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
      fetchImpl: vi.fn().mockResolvedValue(publicResponse('none')),
    })).rejects.toThrow('Byte hash changed');
  });

  it('reports external images without attempting an update', async () => {
    const { client, update } = makeClient({ beforeBytes: await makeWebp() });
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
