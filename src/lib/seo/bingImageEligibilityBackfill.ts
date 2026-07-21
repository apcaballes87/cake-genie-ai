import { createHash } from 'node:crypto';
import sharp from 'sharp';

import { getSeoImageUploadHeaders, SEO_IMAGE_X_ROBOTS_TAG } from '@/lib/seo/storageImageHeaders';

export const BING_IMAGE_STORAGE_BUCKET = 'cakegenie';
export const BING_IMAGE_BACKFILL_CONCURRENCY = 4;
export const BING_IMAGE_BACKFILL_PAGE_BATCH_SIZE = 250;

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
};

export type StorageUpdateClient = {
  storage: {
    from(bucket: string): {
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
  status: 'updated' | 'already-eligible' | 'dry-run' | 'external-skipped';
  sha256?: string;
  objectPath?: string;
  priorRobotsTag?: string | null;
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

function addVerificationCacheBust(value: string): string {
  const url = new URL(value);
  url.searchParams.set('seo_verify', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return url.toString();
}

export async function readPublicImageSnapshot(
  publicUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<PublicImageSnapshot> {
  const response = await fetchImpl(addVerificationCacheBust(publicUrl), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}: ${publicUrl}`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Expected an image response, received ${contentType || 'unknown'}: ${publicUrl}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error(`Image response was empty: ${publicUrl}`);
  }

  const metadata = await sharp(bytes).metadata();

  return {
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contentType,
    cacheControl: response.headers.get('cache-control'),
    xRobotsTag: response.headers.get('x-robots-tag'),
    width: metadata.width ?? null,
    height: metadata.height ?? null,
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

  const before = await readPublicImageSnapshot(object.publicUrl, fetchImpl);
  if (before.xRobotsTag?.trim().toLowerCase() === SEO_IMAGE_X_ROBOTS_TAG) {
    return {
      url: object.publicUrl,
      objectPath: object.objectPath,
      status: 'already-eligible',
      sha256: before.sha256,
      priorRobotsTag: before.xRobotsTag,
    };
  }

  if (!apply) {
    return {
      url: object.publicUrl,
      objectPath: object.objectPath,
      status: 'dry-run',
      sha256: before.sha256,
      priorRobotsTag: before.xRobotsTag,
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

  const after = await readPublicImageSnapshot(object.publicUrl, fetchImpl);
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
    status: 'updated',
    sha256: after.sha256,
    priorRobotsTag: before.xRobotsTag,
  };
}
