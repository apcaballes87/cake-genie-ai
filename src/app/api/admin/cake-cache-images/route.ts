import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

import {
  ADMIN_IMAGE_STUDIO_PIN,
  buildImageStudioPrompt,
  getImageStudioOutputDimensions,
  getImageStudioStoragePath,
  IMAGE_STUDIO_PAGE_SIZE,
  IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD,
  IMAGE_STUDIO_WATERMARK_LOGO_URL,
  normalizeImageStudioStatus,
} from '@/lib/admin/imageStudio';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { createPublicServerSupabaseClient } from '@/lib/supabase/publicServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const MODEL_NAME = 'gemini-2.5-flash-image';
const STORAGE_BUCKET = 'cakegenie';

let cachedLogoBuffer: Buffer | null = null;
async function getLogoBuffer() {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  const res = await fetch(IMAGE_STUDIO_WATERMARK_LOGO_URL, { cache: 'force-cache' });
  if (!res.ok) throw new Error('Failed to fetch brand logo');
  const buffer = Buffer.from(await res.arrayBuffer());
  cachedLogoBuffer = buffer;
  return buffer;
}

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

type CacheRow = {
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

function isAuthorized(req: NextRequest) {
  return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/[^a-zA-Z0-9\s-]/g, ' ').trim().replace(/\s+/g, ' ');
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function mapCacheRow(row: CacheRow) {
  return {
    ...row,
    studio_edit_status: normalizeImageStudioStatus(row.studio_edit_status),
    studio_edited_image_url: row.studio_edited_image_url ?? null,
    studio_edit_error: row.studio_edit_error ?? null,
    studio_edited_at: row.studio_edited_at ?? null,
  };
}

function extractGeneratedImage(response: AiGenerateContentResponse) {
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
}

function extractTextResponse(response: AiGenerateContentResponse) {
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
}

function detectMimeType(url: string, fallback: string | null) {
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
}

async function fetchImageAsInlineData(url: string) {
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
}

async function finalizeEditedImage(
  buffer: Buffer,
  dimensions?: { width: number; height: number; wasUpscaled: boolean } | null
) {
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

  // Add floating background logo
  try {
    const logoBuffer = await getLogoBuffer();
    const logoWidth = Math.round(width * 0.9);
    const resizedLogoBuffer = await sharp(logoBuffer).resize(logoWidth).toBuffer();

    const logoMetadata = await sharp(resizedLogoBuffer).metadata();
    const logoHeight = logoMetadata.height ?? 0;

    // Position behind the cake
    const left = Math.round((width - logoWidth) / 2);
    const top = Math.round((height - logoHeight) / 2);

    enhancedImage.composite([
      {
        input: resizedLogoBuffer,
        top,
        left,
        blend: 'overlay', // Soft blend to make it look like it's in the background/behind
      },
    ]);
  } catch (err) {
    console.error('Failed to overlay brand logo:', err);
  }

  return enhancedImage
    .webp({
      quality: dimensions?.wasUpscaled ? 96 : 92,
      effort: 6,
    })
    .toBuffer();
}


function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Image editing failed.';
}

function createStatusError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 9999);
  const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), IMAGE_STUDIO_PAGE_SIZE, 60);
  const search = sanitizeSearchTerm(url.searchParams.get('search') ?? '');
  const rawStatus = url.searchParams.get('status');
  const status =
    !rawStatus || rawStatus === 'all' ? 'all' : normalizeImageStudioStatus(rawStatus);
  const sizeFilter = url.searchParams.get('size') === 'small' ? 'small' : 'all';

  const supabase = createPublicServerSupabaseClient();
  let query = supabase
    .from('cakegenie_analysis_cache')
    .select('*', { count: 'exact' })
    .not('original_image_url', 'is', null)
    .neq('original_image_url', '');

  if (status !== 'all') {
    query = query.eq('studio_edit_status', status);
  }

  const searchConditions = search
    ? [
        `seo_title.ilike.%${search}%`,
        `slug.ilike.%${search.replace(/\s+/g, '-')}%`,
        `keywords.ilike.%${search}%`,
      ]
    : [];
  const sizeConditions =
    sizeFilter === 'small'
      ? [
          `image_width.lt.${IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD}`,
          `image_height.lt.${IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD}`,
        ]
      : [];

  if (searchConditions.length > 0 && sizeConditions.length > 0) {
    query = query.or(
      `and(or(${searchConditions.join(',')}),or(${sizeConditions.join(',')}))`
    );
  } else if (searchConditions.length > 0) {
    query = query.or(searchConditions.join(','));
  } else if (sizeConditions.length > 0) {
    query = query.or(sizeConditions.join(','));
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Failed to load image studio cache rows:', error);
    return NextResponse.json(
      {
        error: `Failed to load image cache rows. ${error.message}${
          error.hint ? ` Hint: ${error.hint}` : ''
        }`,
      },
      { status: 500 }
    );
  }

  const items = ((data ?? []) as CacheRow[]).map(mapCacheRow);

  return NextResponse.json({
    items,
    page,
    pageSize,
    totalCount: count ?? items.length,
    totalPages: Math.max(1, Math.ceil((count ?? items.length) / pageSize)),
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  const startedAt = Date.now();
  const supabase = createPublicServerSupabaseClient();
  let requestedPHash = '';

  try {
    const body = await req.json();
    const pHash = typeof body?.pHash === 'string' ? body.pHash.trim() : '';
    requestedPHash = pHash;

    if (!pHash) {
      return NextResponse.json({ error: 'Missing required field: pHash' }, { status: 400 });
    }

    const { data: row, error: rowError } = await supabase
      .from('cakegenie_analysis_cache')
      .select('*')
      .eq('p_hash', pHash)
      .single();

    if (rowError || !row) {
      return NextResponse.json({ error: 'Image cache row not found.' }, { status: 404 });
    }

    const cacheRow = row as CacheRow;

    if (!cacheRow.original_image_url) {
      return NextResponse.json(
        { error: 'This row does not have an original image URL to edit.' },
        { status: 400 }
      );
    }

    const startedIso = new Date().toISOString();
    const { error: processingError } = await supabase
      .from('cakegenie_analysis_cache')
      .update({
        studio_edit_status: 'processing',
        studio_edit_error: null,
        studio_edit_started_at: startedIso,
      })
      .eq('p_hash', pHash);

    if (processingError) {
      console.error('Failed to set processing state:', processingError);
      return NextResponse.json(
        {
          error:
            'Unable to update the studio edit status. Please apply the latest Supabase migration first.',
        },
        { status: 500 }
      );
    }

    const originalImage = await fetchImageAsInlineData(cacheRow.original_image_url);
    const prompt = buildImageStudioPrompt();
    const aiClient = getAI();

    const aiResponse = await aiClient.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
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
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

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
      cacheRow.image_width ?? generatedMetadata.width ?? null,
      cacheRow.image_height ?? generatedMetadata.height ?? null
    );
    const watermarkedBuffer = await finalizeEditedImage(
      generatedBuffer,
      outputDimensions
    );
    const storagePath = getImageStudioStoragePath({
      slug: cacheRow.slug,
      pHash,
    });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, watermarkedBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    const completedAt = new Date().toISOString();
    const updatePayload = {
      original_image_url: publicUrl,
      image_width: outputDimensions?.width ?? generatedMetadata.width,
      image_height: outputDimensions?.height ?? generatedMetadata.height,
      studio_edited_image_url: null,
      studio_edit_status: 'completed',
      studio_edit_error: null,
      studio_edited_at: completedAt,
    };

    const { error: saveError } = await supabase
      .from('cakegenie_analysis_cache')
      .update(updatePayload)
      .eq('p_hash', pHash);

    if (saveError) {
      throw new Error(saveError.message);
    }

    return NextResponse.json({
      item: mapCacheRow({
        ...cacheRow,
        ...updatePayload,
      }),
      durationMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    const normalizedError = normalizeAiRouteError(error, {
      defaultMessage: 'Failed to create the studio image.',
      quotaMessage:
        'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
    });

    if (requestedPHash) {
      await supabase
        .from('cakegenie_analysis_cache')
        .update({
          studio_edit_status: 'failed',
          studio_edit_error: normalizedError.message.slice(0, 500),
        })
        .eq('p_hash', requestedPHash);
    }

    console.error('Image studio edit failed:', {
      status: normalizedError.status,
      message: normalizedError.message,
      rawMessage: getErrorMessage(error),
    });

    return NextResponse.json(
      { error: normalizedError.message },
      { status: normalizedError.status }
    );
  }
}
