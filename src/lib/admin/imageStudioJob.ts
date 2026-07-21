import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildImageStudioPrompt,
  buildImageStudioSystemInstruction,
  getImageStudioOutputDimensions,
  getImageStudioStoragePath,
} from '@/lib/admin/imageStudio';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { createPublicServerSupabaseClient } from '@/lib/supabase/publicServer';
import { getSeoImageUploadHeaders } from '@/lib/seo/storageImageHeaders';

const MODEL_NAME = 'gemini-3.1-flash-lite-image';
const STORAGE_BUCKET = 'cakegenie';
const DEFAULT_CACHE_ROW_WAIT_ATTEMPTS = 45;
const DEFAULT_CACHE_ROW_WAIT_MS = 1000;
// When the cache row hasn't been written yet by the analyze flow, we still
// publish the studio image to storage and return success. The completed-status
// row update is retried in two phases:
//   1. INLINE phase — short, blocks the runImageStudioJob return so callers
//      that want the row see it most of the time.
//   2. BACKGROUND phase — fire-and-forget tail that keeps trying for ~30s in
//      case the analyze flow is unusually slow. Lets us cap the inline wait
//      without losing eventual consistency.
const INLINE_ROW_WAIT_ATTEMPTS = 5;
const INLINE_ROW_WAIT_MS = 500;
const BACKGROUND_ROW_WAIT_ATTEMPTS = 30;
const BACKGROUND_ROW_WAIT_MS = 1000;

type AIRequestContext = {
  headers?: {
    get(name: string): string | null | undefined;
  };
} | null | undefined;

type AiInlineDataPart = {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
  text?: string;
};

type AiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: AiInlineDataPart[];
    };
  }>;
  data?: string;
  mimeType?: string;
  text?: string | (() => string);
};

export type ImageStudioInlineImage = {
  data: string;
  mimeType: string;
};

export type ImageStudioCacheRow = {
  p_hash: string;
  slug: string | null;
  seo_title: string | null;
  keywords: string | null;
  price: number | null;
  availability: string | null;
  original_image_url: string | null;
  image_width?: number | null;
  image_height?: number | null;
  studio_edited_image_url?: string | null;
  studio_edit_status?: string | null;
  studio_edit_error?: string | null;
  created_at?: string | null;
  studio_edited_at?: string | null;
};

type StudioUpdatePayload = {
  studio_edited_image_url?: string | null;
  studio_edit_status: 'processing' | 'completed' | 'failed';
  studio_edit_error?: string | null;
  studio_edit_started_at?: string | null;
  studio_edited_at?: string | null;
  image_width?: number | null;
  image_height?: number | null;
};

type PersistStudioUpdateOptions = {
  waitForRow?: boolean;
  maxAttempts?: number;
  waitMs?: number;
};

export type RunImageStudioJobOptions = {
  pHash: string;
  requestContext?: AIRequestContext;
  inlineOriginalImage?: ImageStudioInlineImage | null;
  requireExistingRow?: boolean;
  waitForCacheRow?: boolean;
  client?: SupabaseClient;
};

export type RunImageStudioJobResult = {
  cacheRow: ImageStudioCacheRow | null;
  durationMs: number;
  persistedToCacheRow: boolean;
  publicUrl: string;
  storagePath: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Image editing failed.';
};

const createStatusError = (status: number, message: string) => {
  return Object.assign(new Error(message), { status });
};

const extractGeneratedImage = (response: AiGenerateContentResponse | undefined | null) => {
  const candidate = response?.candidates?.[0];
  const partsResponse = candidate?.content?.parts;
  const imagePart = partsResponse?.find((part) => part.inlineData?.data);

  if (imagePart?.inlineData?.data) {
    return {
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    };
  }

  if (typeof response?.data === 'string' && response.data.trim()) {
    return {
      imageData: response.data,
      mimeType: response?.mimeType || 'image/png',
    };
  }

  return null;
};

const extractTextResponse = (response: AiGenerateContentResponse | undefined | null) => {
  if (typeof response?.text === 'string') {
    return response.text;
  }

  if (typeof response?.text === 'function') {
    try {
      return response.text();
    } catch {
      return '';
    }
  }

  const textParts = response?.candidates?.flatMap((candidate) =>
    candidate?.content?.parts?.filter((part) => typeof part?.text === 'string') ?? []
  ) ?? [];

  return textParts.map((part) => part.text).join('\n').trim();
};

const detectMimeType = (url: string, fallback: string | null) => {
  if (fallback?.startsWith('image/')) {
    return fallback;
  }

  const extension = url.split('?')[0]?.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
};

const fetchImageAsInlineData = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Failed to fetch original image (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = detectMimeType(url, response.headers.get('content-type'));

  return {
    data: Buffer.from(arrayBuffer).toString('base64'),
    mimeType,
  };
};

let cachedLogoBuffer: Buffer | null = null;
async function getLogoBuffer(): Promise<Buffer> {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  const logoUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/new%20genie%20logo%20long.webp';
  const response = await fetch(logoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download watermark logo: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  cachedLogoBuffer = Buffer.from(arrayBuffer);
  return cachedLogoBuffer;
}

const finalizeEditedImage = async (
  buffer: Buffer,
  dimensions?: { width: number; height: number; wasUpscaled: boolean } | null
) => {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = dimensions?.width ?? metadata.width ?? 1200;
  const height = dimensions?.height ?? metadata.height ?? 1200;

  const resizedImage =
    dimensions?.wasUpscaled && metadata.width && metadata.height
      ? image.resize(width, height, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      : image;

  const enhancedImage = dimensions?.wasUpscaled
    ? resizedImage.sharpen(0.8, 1, 2)
    : resizedImage;

  // Apply the watermark Genie logo
  try {
    const logoBuffer = await getLogoBuffer();
    const targetLogoWidth = Math.round(width / 3);
    const logoResizedBuffer = await sharp(logoBuffer)
      .resize({ width: targetLogoWidth })
      .ensureAlpha()
      .linear([1, 1, 1, 0.5], [0, 0, 0, 0])
      .png()
      .toBuffer();

    const padding = Math.round(width * 0.03);
    const top = padding;
    const left = width - targetLogoWidth - padding;

    return await enhancedImage
      .composite([
        {
          input: logoResizedBuffer,
          top: top,
          left: left,
        },
      ])
      .webp({
        // quality 92 is visually indistinguishable from 96 for cake photos but encodes much faster.
        // effort 4 cuts WebP encode time roughly in half vs effort 6 for ~1-2% extra file size,
        // which is invisible to users and not worth ~0.7-1.5s of server CPU per studio image.
        quality: 92,
        effort: 4,
      })
      .toBuffer();
  } catch (watermarkError) {
    console.error('Failed to apply watermark, falling back to clean image:', watermarkError);
    return enhancedImage
      .webp({
        quality: 92,
        effort: 4,
      })
      .toBuffer();
  }
};

async function getCacheRowByHash(
  supabase: SupabaseClient,
  pHash: string
): Promise<ImageStudioCacheRow | null> {
  const { data, error } = await supabase
    .from('cakegenie_analysis_cache')
    .select('*')
    .eq('p_hash', pHash)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load image cache row. ${error.message}`);
  }

  return (data as ImageStudioCacheRow | null) ?? null;
}

async function updateCacheRowByHash(
  supabase: SupabaseClient,
  pHash: string,
  payload: StudioUpdatePayload
): Promise<ImageStudioCacheRow | null> {
  const { data, error } = await supabase
    .from('cakegenie_analysis_cache')
    .update(payload)
    .eq('p_hash', pHash)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update image cache row. ${error.message}`);
  }

  return (data as ImageStudioCacheRow | null) ?? null;
}

export async function persistStudioUpdateWithRetry(
  supabase: SupabaseClient,
  pHash: string,
  payload: StudioUpdatePayload,
  {
    waitForRow = false,
    maxAttempts = DEFAULT_CACHE_ROW_WAIT_ATTEMPTS,
    waitMs = DEFAULT_CACHE_ROW_WAIT_MS,
  }: PersistStudioUpdateOptions = {}
): Promise<ImageStudioCacheRow | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const updatedRow = await updateCacheRowByHash(supabase, pHash, payload);

    if (updatedRow) {
      return updatedRow;
    }

    if (!waitForRow || attempt === maxAttempts - 1) {
      return null;
    }

    await sleep(waitMs);
  }

  return null;
}

export async function runImageStudioJob({
  pHash,
  requestContext,
  inlineOriginalImage = null,
  requireExistingRow = false,
  waitForCacheRow = false,
  client,
}: RunImageStudioJobOptions): Promise<RunImageStudioJobResult> {
  const startedAt = Date.now();
  const supabase = client ?? createPublicServerSupabaseClient();
  let cacheRow: ImageStudioCacheRow | null = null;
  let canWaitForRow = waitForCacheRow;

  try {
    cacheRow = await getCacheRowByHash(supabase, pHash);

    if (waitForCacheRow && !cacheRow) {
      console.log(`[AI Studio] Cache row not found for ${pHash}. Retrying for up to 5s...`);
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        await sleep(500);
        cacheRow = await getCacheRowByHash(supabase, pHash);
        if (cacheRow) {
          console.log(`[AI Studio] Cache row resolved on attempt ${attempt} for ${pHash}.`);
          break;
        }
      }
    }

    if (requireExistingRow && !cacheRow) {
      throw createStatusError(404, 'Image cache row not found.');
    }

    if (!inlineOriginalImage && !cacheRow?.original_image_url) {
      throw createStatusError(
        cacheRow ? 400 : 404,
        cacheRow
          ? 'This row does not have an original image URL to edit.'
          : 'Image cache row not found.'
      );
    }

    if (cacheRow) {
      const processingRow = await persistStudioUpdateWithRetry(supabase, pHash, {
        studio_edit_status: 'processing',
        studio_edit_error: null,
        studio_edit_started_at: new Date().toISOString(),
      });

      if (!processingRow) {
        throw createStatusError(
          500,
          'Unable to update the studio edit status. Please apply the latest Supabase migration first.'
        );
      }

      cacheRow = processingRow;
      canWaitForRow = true;
    }

    const originalImage =
      inlineOriginalImage ?? await fetchImageAsInlineData(cacheRow!.original_image_url!);
    const prompt = buildImageStudioPrompt();
    const systemInstruction = buildImageStudioSystemInstruction();
    const aiClient = getAI(requestContext);

    let aiResponse: AiGenerateContentResponse | undefined;
    const maxAiRetries = 3;

    for (let attempt = 0; attempt <= maxAiRetries; attempt += 1) {
      try {
        aiResponse = await aiClient.models.generateContent({
          model: MODEL_NAME,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: originalImage.mimeType,
                    data: originalImage.data,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            systemInstruction,
            responseModalities: ['IMAGE'],
          },
        }) as AiGenerateContentResponse;
        break;
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : String(error);
        const isQuotaError = /RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(rawMessage);

        if (isQuotaError && attempt < maxAiRetries) {
          const backoffMs = Math.pow(2, attempt) * 4000 + Math.random() * 2000;
          console.warn(`[AI Studio] Quota hit (429). Attempt ${attempt + 1}/${maxAiRetries + 1}. Retrying in ${Math.round(backoffMs)}ms...`);
          await sleep(backoffMs);
          continue;
        }

        throw error;
      }
    }

    const generatedImage = extractGeneratedImage(aiResponse);

    if (!generatedImage) {
      const fallbackText = extractTextResponse(aiResponse);
      throw createStatusError(
        fallbackText ? 422 : 502,
        fallbackText
          ? `AI returned text instead of an edited image. ${fallbackText}`
          : 'AI did not return an edited image. Please try again.'
      );
    }

    const generatedBuffer = Buffer.from(generatedImage.imageData, 'base64');
    const generatedMetadata = await sharp(generatedBuffer).metadata();
    const outputDimensions = getImageStudioOutputDimensions(
      generatedMetadata.width ?? null,
      generatedMetadata.height ?? null
    );
    const watermarkedBuffer = await finalizeEditedImage(
      generatedBuffer,
      outputDimensions
    );
    const finalizedMetadata = await sharp(watermarkedBuffer).metadata().catch(() => null);
    const finalizedWidth = finalizedMetadata?.width ?? generatedMetadata.width ?? null;
    const finalizedHeight = finalizedMetadata?.height ?? generatedMetadata.height ?? null;
    const storagePath = getImageStudioStoragePath({
      slug: cacheRow?.slug ?? null,
      pHash,
    });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, watermarkedBuffer, {
        contentType: 'image/webp',
        upsert: true,
        headers: getSeoImageUploadHeaders(),
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    const updatedRow = await persistStudioUpdateWithRetry(
      supabase,
      pHash,
      {
        studio_edited_image_url: publicUrl,
        studio_edit_status: 'completed',
        studio_edit_error: null,
        studio_edited_at: new Date().toISOString(),
        image_width: finalizedWidth,
        image_height: finalizedHeight,
      },
      {
        waitForRow: canWaitForRow,
        // Cap the inline wait so the studio job returns promptly even when the
        // analyze flow's cache write hasn't landed yet. Background retry below
        // covers the slow case.
        maxAttempts: canWaitForRow ? INLINE_ROW_WAIT_ATTEMPTS : 1,
        waitMs: INLINE_ROW_WAIT_MS,
      }
    );

    if (!updatedRow && canWaitForRow) {
      // Row didn't exist within the inline window. Spawn a background tail
      // so the row gets updated once the analyze flow's upsert completes.
      // Storage upload already succeeded — the user's UI (subscribed via
      // Realtime) will surface the studio image as soon as this lands.
      console.warn(`[AI Studio] Inline row update missed window for ${pHash}; scheduling background tail.`);
      void persistStudioUpdateWithRetry(
        supabase,
        pHash,
        {
          studio_edited_image_url: publicUrl,
          studio_edit_status: 'completed',
          studio_edit_error: null,
          studio_edited_at: new Date().toISOString(),
          image_width: finalizedWidth,
          image_height: finalizedHeight,
        },
        {
          waitForRow: true,
          maxAttempts: BACKGROUND_ROW_WAIT_ATTEMPTS,
          waitMs: BACKGROUND_ROW_WAIT_MS,
        }
      ).then((row) => {
        if (row) {
          console.log(`[AI Studio] Background tail attached studio image to ${pHash}.`);
        } else {
          console.warn(`[AI Studio] Background tail timed out waiting for cache row ${pHash}.`);
        }
      }).catch((tailError) => {
        console.warn(`[AI Studio] Background tail update failed for ${pHash}:`, tailError);
      });
    } else if (!updatedRow) {
      console.warn(`[AI Studio] Completed studio image for ${pHash}, but no cache row was available to attach the result.`);
    }

    return {
      cacheRow: updatedRow,
      durationMs: Date.now() - startedAt,
      persistedToCacheRow: Boolean(updatedRow),
      publicUrl,
      storagePath,
    };
  } catch (error: unknown) {
    const normalizedError = normalizeAiRouteError(error, {
      defaultMessage: 'Failed to create the studio image.',
      quotaMessage:
        'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
    });

    if (pHash) {
      try {
        await persistStudioUpdateWithRetry(
          supabase,
          pHash,
          {
            studio_edit_status: 'failed',
            studio_edit_error: normalizedError.message.slice(0, 500),
          },
          {
            waitForRow: canWaitForRow,
            maxAttempts: canWaitForRow ? INLINE_ROW_WAIT_ATTEMPTS : 1,
            waitMs: INLINE_ROW_WAIT_MS,
          }
        );
      } catch (statusError) {
        console.error('Failed to persist studio edit failure status:', statusError);
      }
    }

    const statusError = createStatusError(normalizedError.status, normalizedError.message);
    console.error('Image studio edit failed:', {
      status: normalizedError.status,
      message: normalizedError.message,
      rawMessage: getErrorMessage(error),
      pHash,
    });
    throw statusError;
  }
}
