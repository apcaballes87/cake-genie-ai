import { createHash } from 'node:crypto';
import sharp from 'sharp';

import { getSeoImageUploadHeaders, SEO_IMAGE_X_ROBOTS_TAG } from '@/lib/seo/storageImageHeaders';

export const BING_IMAGE_STORAGE_BUCKET = 'cakegenie';
export const BING_IMAGE_BACKFILL_CONCURRENCY = 4;
export const BING_IMAGE_BACKFILL_PAGE_BATCH_SIZE = 250;
export const BING_IMAGE_PUBLIC_VERIFY_CONCURRENCY = 16;
export const BING_IMAGE_PUBLIC_VERIFY_INTERVAL_MS = 15_000;
export const BING_IMAGE_PUBLIC_VERIFY_TIMEOUT_MS = 120_000;

const PUBLIC_OBJECT_PREFIX = '/storage/v1/object/public/';
const ALLOWED_OBJECT_PREFIXES = [
  'variants/',
  'analysis-cache/',
  'admin/image-studio/',
  'customizations/',
] as const;

export type StorageObjectReference = {
  bucket: string;
  objectPath: string;
  publicUrl: string;
};

export type PublicImageSnapshot = {
  bytes: Uint8Array;
  sha256: string;
  contentType: string;
  cacheControl: string | null;
  xRobotsTag: string | null;
  width: number | null;
  height: number | null;
  storageMetadata: Record<string, unknown>;
};

export type StoredImageAuditSnapshot = Omit<PublicImageSnapshot, 'bytes'>;

export type PublicImageHeaderSnapshot = {
  url: string;
  status: number;
  contentType: string | null;
  contentRange: string | null;
  xRobotsTag: string | null;
  cacheControl: string | null;
  cfCacheStatus: string | null;
  eligible: boolean;
};

export type StorageUpdateClient = {
  storage: {
    from(bucket: string): {
      list(
        path: string,
        options: { search: string; limit: number },
      ): Promise<{
        data: Array<{ name: string; metadata?: Record<string, unknown> | null }> | null;
        error: { message: string } | null;
      }>;
      download(path: string): Promise<{
        data: Blob | null;
        error: { message: string } | null;
      }>;
      update(
        path: string,
        body: Uint8Array,
        options: {
          contentType: string;
          cacheControl: string;
          headers: Record<string, string>;
        },
      ): Promise<{ error: { message: string } | null }>;
    };
  };
};

export type ImageEligibilityResult = {
  url: string;
  status: 'updated-pending-public' | 'already-eligible' | 'public-blocked' | 'external-skipped';
  sha256?: string;
  objectPath?: string;
  priorRobotsTag?: string | null;
  publicSnapshot?: PublicImageHeaderSnapshot;
  storageBefore?: StoredImageAuditSnapshot;
  storageAfter?: StoredImageAuditSnapshot;
  storageUpdatedAt?: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function parseGenieStorageObjectUrl(
  value: string,
  expectedSupabaseOrigin: string,
): StorageObjectReference | null {
  let parsed: URL;
  let expected: URL;

  try {
    parsed = new URL(value);
    expected = new URL(expectedSupabaseOrigin);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || parsed.origin !== expected.origin) {
    return null;
  }

  if (!parsed.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) {
    return null;
  }

  const storagePath = decodeURIComponent(parsed.pathname.slice(PUBLIC_OBJECT_PREFIX.length));
  const slashIndex = storagePath.indexOf('/');
  if (slashIndex <= 0) {
    return null;
  }

  const bucket = storagePath.slice(0, slashIndex);
  const objectPath = storagePath.slice(slashIndex + 1);
  if (bucket !== BING_IMAGE_STORAGE_BUCKET || !objectPath) {
    return null;
  }

  const pathSegments = objectPath.split('/');
  if (pathSegments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0'))) {
    return null;
  }

  if (!ALLOWED_OBJECT_PREFIXES.some((prefix) => objectPath.startsWith(prefix))) {
    return null;
  }

  return {
    bucket,
    objectPath,
    publicUrl: `${parsed.origin}${parsed.pathname}`,
  };
}

export function isExternalImageUrl(value: string, expectedSupabaseOrigin: string): boolean {
  try {
    return new URL(value).origin !== new URL(expectedSupabaseOrigin).origin;
  } catch {
    return false;
  }
}

export function cacheControlMaxAge(value: string | null): string {
  const match = value?.match(/(?:^|,)\s*max-age=(\d+)/i);
  return match?.[1] ?? '0';
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

async function readStoredImageSnapshot(
  client: StorageUpdateClient,
  object: StorageObjectReference,
): Promise<PublicImageSnapshot> {
  const slashIndex = object.objectPath.lastIndexOf('/');
  const directory = slashIndex === -1 ? '' : object.objectPath.slice(0, slashIndex);
  const fileName = object.objectPath.slice(slashIndex + 1);
  const bucket = client.storage.from(object.bucket);

  const { data: listed, error: listError } = await bucket.list(directory, {
    search: fileName,
    limit: 100,
  });
  if (listError) {
    throw new Error(`Storage metadata lookup failed for ${object.objectPath}: ${listError.message}`);
  }

  const item = listed?.find((candidate) => candidate.name === fileName);
  if (!item) {
    throw new Error(`Storage object was not found at the exact selected path: ${object.objectPath}`);
  }

  const { data: blob, error: downloadError } = await bucket.download(object.objectPath);
  if (downloadError || !blob) {
    throw new Error(`Storage download failed for ${object.objectPath}: ${downloadError?.message ?? 'empty response'}`);
  }

  const metadata = item.metadata ?? {};
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error(`Storage object was empty: ${object.objectPath}`);
  }

  const contentType = metadataString(metadata, 'mimetype') ?? blob.type;
  if (!contentType.startsWith('image/')) {
    throw new Error(`Expected an image object, received ${contentType || 'unknown'}: ${object.objectPath}`);
  }

  const imageMetadata = await sharp(bytes).metadata();
  return {
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contentType,
    cacheControl: metadataString(metadata, 'cacheControl'),
    xRobotsTag: metadataString(metadata, 'xRobotsTag'),
    width: imageMetadata.width ?? null,
    height: imageMetadata.height ?? null,
    storageMetadata: metadata,
  };
}

function toStoredImageAuditSnapshot(snapshot: PublicImageSnapshot): StoredImageAuditSnapshot {
  return {
    sha256: snapshot.sha256,
    contentType: snapshot.contentType,
    cacheControl: snapshot.cacheControl,
    xRobotsTag: snapshot.xRobotsTag,
    width: snapshot.width,
    height: snapshot.height,
    storageMetadata: snapshot.storageMetadata,
  };
}

export function isPublicImageRobotsEligible(value: string | null): boolean {
  if (!value) return false;

  const directives = new Set(
    value
      .toLowerCase()
      .split(/[;,]/)
      .map((directive) => directive.trim())
      .filter(Boolean),
  );

  return directives.has('all')
    && !directives.has('none')
    && !directives.has('noindex')
    && !directives.has('noimageindex');
}

export async function readCanonicalPublicImageHeaders(
  publicUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<PublicImageHeaderSnapshot> {
  const response = await fetchImpl(publicUrl, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      range: 'bytes=0-0',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  await response.arrayBuffer();

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || null;
  const xRobotsTag = response.headers.get('x-robots-tag');
  const validStatus = response.status === 200 || response.status === 206;

  return {
    url: publicUrl,
    status: response.status,
    contentType,
    contentRange: response.headers.get('content-range'),
    xRobotsTag,
    cacheControl: response.headers.get('cache-control'),
    cfCacheStatus: response.headers.get('cf-cache-status'),
    eligible: validStatus
      && Boolean(contentType?.startsWith('image/'))
      && isPublicImageRobotsEligible(xRobotsTag),
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let cursor = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;

      try {
        results[index] = { status: 'fulfilled', value: await worker(values[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }));

  return results;
}

export type PublicEligibilityWaitResult = {
  eligible: PublicImageHeaderSnapshot[];
  blocked: Array<{
    url: string;
    snapshot?: PublicImageHeaderSnapshot;
    error?: string;
  }>;
  attempts: number;
};

export async function waitForPublicImageEligibility({
  urls,
  fetchImpl = fetch,
  sleepImpl = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = BING_IMAGE_PUBLIC_VERIFY_TIMEOUT_MS,
  intervalMs = BING_IMAGE_PUBLIC_VERIFY_INTERVAL_MS,
  concurrency = BING_IMAGE_PUBLIC_VERIFY_CONCURRENCY,
}: {
  urls: string[];
  fetchImpl?: FetchLike;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  intervalMs?: number;
  concurrency?: number;
}): Promise<PublicEligibilityWaitResult> {
  const uniqueUrls = [...new Set(urls)];
  let pending = uniqueUrls;
  const eligible = new Map<string, PublicImageHeaderSnapshot>();
  const latest = new Map<string, PublicEligibilityWaitResult['blocked'][number]>();
  const maxAttempts = intervalMs > 0 ? Math.floor(timeoutMs / intervalMs) + 1 : 1;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts && pending.length > 0; attempt += 1) {
    attempts = attempt;
    const results = await mapWithConcurrency(
      pending,
      concurrency,
      (url) => readCanonicalPublicImageHeaders(url, fetchImpl),
    );

    const nextPending: string[] = [];
    results.forEach((result, index) => {
      const url = pending[index];
      if (result.status === 'fulfilled' && result.value.eligible) {
        eligible.set(url, result.value);
        latest.delete(url);
        return;
      }

      nextPending.push(url);
      latest.set(url, result.status === 'fulfilled'
        ? { url, snapshot: result.value }
        : {
            url,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
    });

    pending = nextPending;
    if (pending.length > 0 && attempt < maxAttempts) {
      await sleepImpl(intervalMs);
    }
  }

  return {
    eligible: [...eligible.values()],
    blocked: pending.map((url) => latest.get(url) ?? { url, error: 'Public verification did not complete.' }),
    attempts,
  };
}

export async function ensurePublicImageEligibility({
  client,
  publicUrl,
  expectedSupabaseOrigin,
  apply,
  fetchImpl = fetch,
}: {
  client: StorageUpdateClient;
  publicUrl: string;
  expectedSupabaseOrigin: string;
  apply: boolean;
  fetchImpl?: FetchLike;
}): Promise<ImageEligibilityResult> {
  const object = parseGenieStorageObjectUrl(publicUrl, expectedSupabaseOrigin);

  if (!object) {
    if (isExternalImageUrl(publicUrl, expectedSupabaseOrigin)) {
      return { url: publicUrl, status: 'external-skipped' };
    }
    throw new Error(`Refusing non-eligible or malformed storage URL: ${publicUrl}`);
  }

  const publicBefore = await readCanonicalPublicImageHeaders(object.publicUrl, fetchImpl);
  if (publicBefore.eligible) {
    return {
      url: object.publicUrl,
      objectPath: object.objectPath,
      status: 'already-eligible',
      publicSnapshot: publicBefore,
    };
  }

  const before = await readStoredImageSnapshot(client, object);

  if (!apply) {
    return {
      url: object.publicUrl,
      objectPath: object.objectPath,
      status: 'public-blocked',
      sha256: before.sha256,
      priorRobotsTag: before.xRobotsTag,
      publicSnapshot: publicBefore,
      storageBefore: toStoredImageAuditSnapshot(before),
    };
  }

  const { error } = await client.storage.from(object.bucket).update(
    object.objectPath,
    before.bytes,
    {
      contentType: before.contentType,
      cacheControl: cacheControlMaxAge(before.cacheControl),
      headers: getSeoImageUploadHeaders(),
    },
  );

  if (error) {
    throw new Error(`Storage update failed for ${object.objectPath}: ${error.message}`);
  }

  const after = await readStoredImageSnapshot(client, object);
  if (after.sha256 !== before.sha256) {
    throw new Error(`Byte hash changed after eligibility update: ${object.publicUrl}`);
  }
  if (after.contentType !== before.contentType) {
    throw new Error(`MIME type changed after eligibility update: ${object.publicUrl}`);
  }
  if (after.width !== before.width || after.height !== before.height) {
    throw new Error(`Image dimensions changed after eligibility update: ${object.publicUrl}`);
  }
  if (after.xRobotsTag?.trim().toLowerCase() !== SEO_IMAGE_X_ROBOTS_TAG) {
    throw new Error(`X-Robots-Tag was not updated to all: ${object.publicUrl}`);
  }

  return {
    url: object.publicUrl,
    objectPath: object.objectPath,
    status: 'updated-pending-public',
    sha256: after.sha256,
    priorRobotsTag: before.xRobotsTag,
    publicSnapshot: publicBefore,
    storageBefore: toStoredImageAuditSnapshot(before),
    storageAfter: toStoredImageAuditSnapshot(after),
    storageUpdatedAt: new Date().toISOString(),
  };
}
