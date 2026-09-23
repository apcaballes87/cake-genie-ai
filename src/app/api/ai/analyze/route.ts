import { NextRequest, NextResponse } from 'next/server';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { runActiveCakeAnalysis } from '@/lib/ai/analyzeCakeImage';
import { getDevelopmentPromptVersionOverride } from './promptVersionOverride';

export const maxDuration = 150; // Internal timeout aborts well before this; keep some headroom for cleanup.

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_ANALYSIS_REQUEST_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

class CakeAnalysisRequestError extends Error {
    constructor(message: string, readonly status: 400 | 413 | 415) {
        super(message);
        this.name = 'CakeAnalysisRequestError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJsonRequestBody(req: NextRequest): Promise<Record<string, unknown>> {
    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader && /^\d+$/.test(contentLengthHeader)
        && Number(contentLengthHeader) > MAX_ANALYSIS_REQUEST_BYTES) {
        throw new CakeAnalysisRequestError('Image request is too large. Please upload a smaller image.', 413);
    }

    const reader = req.body?.getReader();
    if (!reader) throw new CakeAnalysisRequestError('Request body must contain a JSON object.', 400);

    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > MAX_ANALYSIS_REQUEST_BYTES) {
            try {
                await reader.cancel();
            } catch {
                // Preserve the recognized body-size outcome if the incoming stream cannot be cancelled cleanly.
            }
            throw new CakeAnalysisRequestError('Image request is too large. Please upload a smaller image.', 413);
        }
        chunks.push(value);
    }

    const bodyBytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
        bodyBytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    let body: unknown;
    try {
        body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes));
    } catch {
        throw new CakeAnalysisRequestError('Request body must contain valid JSON.', 400);
    }
    if (!isRecord(body)) {
        throw new CakeAnalysisRequestError('Request body must contain a JSON object.', 400);
    }
    return body;
}

function hasImageSignature(bytes: Uint8Array, mimeType: string): boolean {
    if (mimeType === 'image/png') {
        return bytes.length >= 8
            && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
            && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    }
    if (mimeType === 'image/jpeg') {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    return mimeType === 'image/webp'
        && bytes.length >= 12
        && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
        && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
}

function validateAnalysisImage(imageDataValue: unknown, mimeTypeValue: unknown) {
    if (typeof imageDataValue !== 'string' || !imageDataValue.trim()) {
        throw new CakeAnalysisRequestError('Missing or invalid imageData. Send a base64-encoded image.', 400);
    }
    if (typeof mimeTypeValue !== 'string' || !mimeTypeValue.trim()) {
        throw new CakeAnalysisRequestError('Missing or invalid mimeType.', 400);
    }

    const declaredMimeType = mimeTypeValue.trim().toLowerCase();
    const mimeType = declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType;
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
        throw new CakeAnalysisRequestError('Unsupported image type. Use a JPG, PNG, or WebP image.', 415);
    }

    const imageData = imageDataValue.trim();
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(imageData)) {
        throw new CakeAnalysisRequestError('imageData must be valid base64 image data.', 400);
    }
    const imageBytes = Buffer.from(imageData, 'base64');
    if (!hasImageSignature(imageBytes, mimeType)) {
        throw new CakeAnalysisRequestError('The image data does not match its declared image type.', 400);
    }

    return { imageData, mimeType };
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: CORS_HEADERS,
    });
}

// Fail fast on slow AI calls so we can return a clean 504 well before Vercel kills the function.
// The analyze prompt is heavy; most successful calls complete in <90s.
export async function POST(req: NextRequest) {
    try {
        const body = await readJsonRequestBody(req);
        const { imageData, mimeType } = validateAnalysisImage(body.imageData, body.mimeType);
        const sourceContext = body.sourceContext;
        if (sourceContext !== undefined && sourceContext !== null && typeof sourceContext !== 'string') {
            throw new CakeAnalysisRequestError('sourceContext must be a string when provided.', 400);
        }

        const { result } = await runActiveCakeAnalysis({
            imageData,
            mimeType,
            requestContext: req,
            sourceContext: typeof sourceContext === 'string' ? sourceContext : null,
            promptVersion: getDevelopmentPromptVersionOverride(),
        });

        return NextResponse.json(result, { headers: CORS_HEADERS });

    } catch (error) {
        console.error("Error analyzing cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to analyze image',
            quotaMessage: 'AI cake analysis is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration, then confirm project access.',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status, headers: CORS_HEADERS }
        );
    }
}
