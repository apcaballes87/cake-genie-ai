import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
  cacheControlMaxAge,
  ensurePublicImageEligibility,
  isPublicImageRobotsEligible,
  parseGenieStorageObjectUrl,
  purgeSupabaseCdnObject,
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
  listErrors = [],
  downloadErrors = [],
  updateErrors = [],
}: {
  beforeBytes: Uint8Array;
  afterBytes?: Uint8Array;
  initialRobotsTag?: string;
  updatedRobotsTag?: string;
  listErrors?: Array<{ message?: string } | null>;
  downloadErrors?: Array<{ message?: string } | null>;
  updateErrors?: Array<{ message: string } | null>;
}) {
  let updated = false;
  let listAttempt = 0;
  let downloadAttempt = 0;
  let updateAttempt = 0;
  const update = vi.fn().mockImplementation(async () => {
    const error = updateErrors[updateAttempt] ?? null;
    updateAttempt += 1;
    if (error) return { error };
    updated = true;
    return { error: null };
  });
  const list = vi.fn().mockImplementation(async () => {
    const error = listErrors[listAttempt] ?? null;
    listAttempt += 1;
    if (error) return { data: null, error };
    return {
      data: [{
        name: '800.webp',
        metadata: {
          mimetype: 'image/webp',
          cacheControl: 'max-age=31536000',
          xRobotsTag: updated ? updatedRobotsTag : initialRobotsTag,
        },
      }],
      error: null,
    };
  });
  const download = vi.fn().mockImplementation(async () => {
    const error = downloadErrors[downloadAttempt] ?? null;
    downloadAttempt += 1;
    if (error) return { data: null, error };
    return {
      data: {
        type: 'image/webp',
        arrayBuffer: async () => Uint8Array.from(updated ? afterBytes : beforeBytes).buffer,
      } as Blob,
      error: null,
    };
  });
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

  it('accepts only exact legacy public shared-design image patterns', () => {
    const sharedId = '8869e269-33f6-4933-b188-1d5f11932863';
    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/shared-cake-images/shared-cake-images/${sharedId}-original.jpg`,
      SUPABASE_ORIGIN,
    )).toMatchObject({
      bucket: 'shared-cake-images',
      objectPath: `shared-cake-images/${sharedId}-original.jpg`,
    });
    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/shared-cake-images/${sharedId}-customized.png`,
      SUPABASE_ORIGIN,
    )).toMatchObject({
      bucket: 'shared-cake-images',
      objectPath: `${sharedId}-customized.png`,
    });
    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/cakegenie/shared-designs/${sharedId}-original.jpeg`,
      SUPABASE_ORIGIN,
    )).toMatchObject({
      bucket: 'cakegenie',
      objectPath: `shared-designs/${sharedId}-original.jpeg`,
    });

    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/shared-cake-images/customer-uploads/private.jpg`,
      SUPABASE_ORIGIN,
    )).toBeNull();
    expect(parseGenieStorageObjectUrl(
      `${SUPABASE_ORIGIN}/storage/v1/object/public/cakegenie/shared-designs/payment-proof.png`,
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

  it('purges the exact approved object path with a modern secret key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"message":"success"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const result = await purgeSupabaseCdnObject({
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      secretKey: 'sb_secret_test',
      fetchImpl,
    });

    expect(result).toMatchObject({
      url: IMAGE_URL,
      objectPath: 'variants/minimalist-cake-ffff/800.webp',
      status: 200,
      attempts: 1,
    });
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint.toString()).toBe(
      `${SUPABASE_ORIGIN}/storage/v1/cdn/cakegenie/variants/minimalist-cake-ffff/800.webp`,
    );
    expect(init).toMatchObject({
      method: 'DELETE',
      headers: { apikey: 'sb_secret_test' },
    });
  });

  it('uses bearer authorization for a legacy service-role JWT', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"message":"success"}', { status: 200 }));

    await purgeSupabaseCdnObject({
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      secretKey: 'header.payload.signature',
      fetchImpl,
    });

    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { authorization: 'Bearer header.payload.signature' },
    });
  });

  it('retries rate-limited CDN purges and respects retry-after', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', {
        status: 429,
        headers: { 'retry-after': '2' },
      }))
      .mockResolvedValueOnce(new Response('{"message":"success"}', { status: 200 }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const result = await purgeSupabaseCdnObject({
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      secretKey: 'sb_secret_test',
      fetchImpl,
      sleepImpl,
    });

    expect(result.attempts).toBe(2);
    expect(sleepImpl).toHaveBeenCalledWith(2_000);
  });

  it('refuses CDN purges outside the exact approved storage boundary', async () => {
    const fetchImpl = vi.fn();

    await expect(purgeSupabaseCdnObject({
      publicUrl: `${SUPABASE_ORIGIN}/storage/v1/object/public/cakegenie/payment-proofs/proof.webp`,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      secretKey: 'sb_secret_test',
      fetchImpl,
    })).rejects.toThrow('outside the approved storage boundary');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails a non-retryable CDN purge without exposing the secret key', async () => {
    const secretKey = 'sb_secret_must_not_leak';
    const error = await purgeSupabaseCdnObject({
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      secretKey,
      fetchImpl: vi.fn().mockResolvedValue(new Response('not authorized', { status: 401 })),
    }).catch((reason) => reason as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('HTTP 401');
    expect(error.message).not.toContain(secretKey);
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

  it('retries a transient non-JSON storage update response at the same object path', async () => {
    const bytes = await makeWebp();
    const { client, update } = makeClient({
      beforeBytes: bytes,
      updateErrors: [{ message: 'Unexpected token < in JSON at position 0' }, null],
    });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl: vi.fn().mockResolvedValue(publicResponse('none')),
      sleepImpl,
    });

    expect(result.status).toBe('updated-pending-public');
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0]).toBe('variants/minimalist-cake-ffff/800.webp');
    expect(update.mock.calls[1][0]).toBe('variants/minimalist-cake-ffff/800.webp');
    expect(sleepImpl).toHaveBeenCalledWith(1_000);
  });

  it('retries transient storage metadata and download failures before updating', async () => {
    const bytes = await makeWebp();
    const { client, list, download, update } = makeClient({
      beforeBytes: bytes,
      listErrors: [{ message: 'temporary metadata gateway error' }, null],
      downloadErrors: [{}, null],
    });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl: vi.fn().mockResolvedValue(publicResponse('none')),
      sleepImpl,
    });

    expect(result.status).toBe('updated-pending-public');
    expect(list).toHaveBeenCalledTimes(3);
    expect(download).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(1_000);
  });

  it('does not rewrite bytes when metadata is already ready for a CDN purge', async () => {
    const bytes = await makeWebp();
    const { client, update } = makeClient({ beforeBytes: bytes, initialRobotsTag: 'all' });

    const result = await ensurePublicImageEligibility({
      client,
      publicUrl: IMAGE_URL,
      expectedSupabaseOrigin: SUPABASE_ORIGIN,
      apply: true,
      fetchImpl: vi.fn().mockResolvedValue(publicResponse('none')),
    });

    expect(result).toMatchObject({
      status: 'metadata-ready-public-blocked',
      priorRobotsTag: 'all',
      publicSnapshot: { eligible: false, xRobotsTag: 'none' },
    });
    expect(update).not.toHaveBeenCalled();
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
