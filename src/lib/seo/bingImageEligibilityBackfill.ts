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
  };
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
}: {
  client: StorageUpdateClient;
  publicUrl: string;
  expectedSupabaseOrigin: string;
  apply: boolean;
}): Promise<ImageEligibilityResult> {
  const object = parseGenieStorageObjectUrl(publicUrl, expectedSupabaseOrigin);

  if (!object) {
    if (isExternalImageUrl(publicUrl, expectedSupabaseOrigin)) {
      return { url: publicUrl, status: 'external-skipped' };
    }
    throw new Error(`Refusing non-eligible or malformed storage URL: ${publicUrl}`);
  }

  // Read from the authenticated Storage origin. Reading the public URL here
  // would warm a stale restrictive Smart CDN response immediately before the
  // byte-identical metadata rewrite.
  const before = await readStoredImageSnapshot(client, object);
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
    status: 'updated',
    sha256: after.sha256,
    priorRobotsTag: before.xRobotsTag,
  };
}
