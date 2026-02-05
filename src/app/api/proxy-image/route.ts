import { NextRequest, NextResponse } from 'next/server';

// Allowlisted hostname patterns for image sources
const ALLOWED_HOSTNAME_PATTERNS = [
    // Supabase storage
    /\.supabase\.co$/,
    /\.supabase\.in$/,
    // Google
    /\.gstatic\.com$/,
    /\.googleusercontent\.com$/,
    /\.googleapis\.com$/,
    /\.ggpht\.com$/,
    // Unsplash
    /\.unsplash\.com$/,
    /^images\.unsplash\.com$/,
    // Facebook CDN
    /\.fbcdn\.net$/,
    /\.facebook\.com$/,
    /\.fb\.com$/,
    // Instagram
    /\.cdninstagram\.com$/,
    /\.instagram\.com$/,
    // Pinterest
    /\.pinimg\.com$/,
    /\.pinterest\.com$/,
];

// Private IP ranges to block (SSRF protection)
const PRIVATE_IP_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./, // Link-local
    /^0\./, // Current network
    /^::1$/, // IPv6 localhost
    /^fc00:/i, // IPv6 private
    /^fe80:/i, // IPv6 link-local
];

const TIMEOUT_MS = 10000; // 10 seconds
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const isAllowedHostname = (hostname: string): boolean => {
    return ALLOWED_HOSTNAME_PATTERNS.some(pattern => pattern.test(hostname));
};

const isPrivateIP = (hostname: string): boolean => {
    return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
};

export async function GET(request: NextRequest) {
    const urlParam = request.nextUrl.searchParams.get('url');

    if (!urlParam) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate and parse URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(urlParam);
    } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Enforce HTTPS only
    if (parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400 });
    }

    // Block private IP ranges (SSRF protection)
    if (isPrivateIP(parsedUrl.hostname)) {
        return NextResponse.json({ error: 'Access to private networks is not allowed' }, { status: 403 });
    }

    // Validate against allowlist
    if (!isAllowedHostname(parsedUrl.hostname)) {
        return NextResponse.json(
            { error: `Hostname not allowed: ${parsedUrl.hostname}` },
            { status: 403 }
        );
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(parsedUrl.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch image' },
                { status: response.status }
            );
        }

        // Check Content-Length header before downloading
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_SIZE_BYTES / 1024 / 1024}MB` },
                { status: 413 }
            );
        }

        // Stream and cap the response size
        const reader = response.body?.getReader();
        if (!reader) {
            return NextResponse.json({ error: 'Failed to read response' }, { status: 500 });
        }

        const chunks: Uint8Array[] = [];
        let totalSize = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalSize += value.length;
            if (totalSize > MAX_SIZE_BYTES) {
                reader.cancel();
                return NextResponse.json(
                    { error: `File too large. Maximum size is ${MAX_SIZE_BYTES / 1024 / 1024}MB` },
                    { status: 413 }
                );
            }
            chunks.push(value);
        }

        // Combine chunks into a single buffer
        const buffer = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }

        const contentType = response.headers.get('content-type');

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType || 'application/octet-stream',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                { error: 'Request timeout - image took too long to fetch' },
                { status: 504 }
            );
        }

        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: 'Internal server error while fetching image' },
            { status: 500 }
        );
    }
}
