import { NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_IMAGE_STUDIO_PIN,
  IMAGE_STUDIO_PAGE_SIZE,
  IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD,
  normalizeImageStudioStatus,
} from '@/lib/admin/imageStudio';
import { runImageStudioJob, type ImageStudioCacheRow } from '@/lib/admin/imageStudioJob';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { createPublicServerSupabaseClient } from '@/lib/supabase/publicServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const isAuthorized = (req: NextRequest) => {
  return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
};

const unauthorizedResponse = () => {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
};

const sanitizeSearchTerm = (value: string) => {
  return value.replace(/[^a-zA-Z0-9\s-]/g, ' ').trim().replace(/\s+/g, ' ');
};

const parsePositiveInt = (value: string | null, fallback: number, max: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const mapCacheRow = (row: ImageStudioCacheRow) => {
  return {
    ...row,
    studio_edit_status: normalizeImageStudioStatus(row.studio_edit_status),
    studio_edited_image_url: row.studio_edited_image_url ?? null,
    studio_edit_error: row.studio_edit_error ?? null,
    studio_edited_at: row.studio_edited_at ?? null,
  };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Image studio request failed.';
};


export const GET = async (req: NextRequest) => {
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
        error: `Failed to load image cache rows. ${error.message}${error.hint ? ` Hint: ${error.hint}` : ''
          }`,
      },
      { status: 500 }
    );
  }

  const items = ((data ?? []) as ImageStudioCacheRow[]).map(mapCacheRow);

  return NextResponse.json({
    items,
    page,
    pageSize,
    totalCount: count ?? items.length,
    totalPages: Math.max(1, Math.ceil((count ?? items.length) / pageSize)),
  });
};

export const POST = async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const pHash = typeof body?.pHash === 'string' ? body.pHash.trim() : '';

    if (!pHash) {
      return NextResponse.json({ error: 'Missing required field: pHash' }, { status: 400 });
    }

    const result = await runImageStudioJob({
      pHash,
      requestContext: req,
      requireExistingRow: true,
    });

    return NextResponse.json({
      item: result.cacheRow ? mapCacheRow(result.cacheRow) : null,
      durationMs: result.durationMs,
    });
  } catch (error: unknown) {
    const normalizedError = normalizeAiRouteError(error, {
      defaultMessage: 'Failed to create the studio image.',
      quotaMessage:
        'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
    });

    return NextResponse.json(
      { error: normalizedError.message },
      { status: normalizedError.status }
    );
  }
};

export const PATCH = async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const pHashes = body?.pHashes;
    const status = body?.status;

    if (!Array.isArray(pHashes) || pHashes.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid pHashes array' },
        { status: 400 }
      );
    }

    const validStatuses = ['not_started', 'processing', 'completed', 'failed'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createPublicServerSupabaseClient();
    const updatePayload: {
      studio_edit_status: string;
      studio_edit_error?: string | null;
      studio_edited_image_url?: string | null;
      studio_edited_at?: string | null;
    } = {
      studio_edit_status: status,
    };

    if (status === 'not_started') {
      updatePayload.studio_edit_error = null;
      updatePayload.studio_edited_image_url = null;
      updatePayload.studio_edited_at = null;
    } else if (status === 'processing') {
      updatePayload.studio_edit_error = null;
    } else if (status === 'completed') {
      updatePayload.studio_edit_error = null;
    }

    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .update(updatePayload)
      .in('p_hash', pHashes)
      .select();

    if (error) {
      console.error('Failed to bulk update cake cache images:', error);
      return NextResponse.json(
        { error: `Database update failed: ${error.message}` },
        { status: 500 }
      );
    }

    const items = (data ?? []).map(mapCacheRow);

    return NextResponse.json({
      success: true,
      updatedCount: items.length,
      items,
    });
  } catch (error: unknown) {
    console.error('Bulk status update route failed:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
};

export const DELETE = async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(req.url);
    const pHash = url.searchParams.get('pHash')?.trim();

    if (!pHash) {
      return NextResponse.json(
        { error: 'Missing required parameter: pHash' },
        { status: 400 }
      );
    }

    const supabase = createPublicServerSupabaseClient();
    const { error } = await supabase
      .from('cakegenie_analysis_cache')
      .delete()
      .eq('p_hash', pHash);

    if (error) {
      console.error('Failed to delete cake cache image:', error);
      return NextResponse.json(
        { error: `Database deletion failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete route failed:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
};

