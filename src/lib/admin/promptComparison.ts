import { runActiveCakeAnalysis } from '@/lib/ai/analyzeCakeImage';
import { isRejectedGeneratedCakeAnalysis } from '@/lib/ai/generatedAnalysisContract';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { calculateCachePriceFromAnalysis } from '@/services/supabaseService';

const SOURCE_IMAGE_TIMEOUT_MS = 30_000;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;

export class PromptComparisonError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'PromptComparisonError';
        this.status = status;
    }
}

function inferMimeType(url: string): string | null {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
    return null;
}

export type PromptComparisonResult = {
    p_hash: string;
    slug: string | null;
    analysis_json: Record<string, unknown> | null;
    price: number | null;
    prompt_version: string;
    is_rejected: boolean;
    rejection_reason?: string;
    rejection_message?: string;
};

export async function runCakeAnalysisWithVersion(
    pHash: string,
    promptVersion: string,
    requestContext?: Request,
): Promise<PromptComparisonResult> {
    const admin = createAdminServerSupabaseClient();

    const { data: cacheRow, error: lookupError } = await admin
        .from('cakegenie_analysis_cache')
        .select('p_hash, slug, price, original_image_url')
        .eq('p_hash', pHash)
        .maybeSingle();

    if (lookupError) {
        throw new PromptComparisonError(`Could not load the cache row: ${lookupError.message}`, 502);
    }
    if (!cacheRow) {
        throw new PromptComparisonError('No cache row exists for this cake item.', 404);
    }
    if (!cacheRow.original_image_url) {
        throw new PromptComparisonError('This cache row has no original image URL.', 422);
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(cacheRow.original_image_url);
    } catch {
        throw new PromptComparisonError('The cache row has an invalid original image URL.', 422);
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new PromptComparisonError('The cache row image URL must use HTTP or HTTPS.', 422);
    }

    const response = await fetch(parsedUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(SOURCE_IMAGE_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new PromptComparisonError(`Could not download the source image (HTTP ${response.status}).`, 502);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_SOURCE_IMAGE_BYTES) {
        throw new PromptComparisonError('The source image is too large for AI analysis.', 413);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
        throw new PromptComparisonError('The source image is empty.', 422);
    }
    if (bytes.byteLength > MAX_SOURCE_IMAGE_BYTES) {
        throw new PromptComparisonError('The source image is too large for AI analysis.', 413);
    }

    const headerMimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    const mimeType = headerMimeType && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(headerMimeType)
        ? headerMimeType
        : inferMimeType(parsedUrl.toString());

    if (!mimeType || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
        throw new PromptComparisonError('The source image format is not supported.', 422);
    }

    const { result, promptVersion: actualVersion } = await runActiveCakeAnalysis({
        imageData: bytes.toString('base64'),
        mimeType,
        requestContext,
        sourceContext: `prompt-comparison:${pHash}:v${promptVersion}`,
        sourceRoute: 'api/admin/cake-analysis-compare',
        persistRejectedUpload: false,
        promptVersion,
    });

    if (isRejectedGeneratedCakeAnalysis(result)) {
        return {
            p_hash: cacheRow.p_hash,
            slug: cacheRow.slug ?? null,
            analysis_json: result as unknown as Record<string, unknown>,
            price: null,
            prompt_version: actualVersion,
            is_rejected: true,
            rejection_reason: result.rejection?.reason,
            rejection_message: result.rejection?.message,
        };
    }

    const price = await calculateCachePriceFromAnalysis(result);

    return {
        p_hash: cacheRow.p_hash,
        slug: cacheRow.slug ?? null,
        analysis_json: result as unknown as Record<string, unknown>,
        price,
        prompt_version: actualVersion,
        is_rejected: false,
    };
}
