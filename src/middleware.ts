import { NextResponse, type NextRequest } from 'next/server'

// Known top-level routes that should never be treated as discount codes
const KNOWN_ROUTES = new Set([
    'about', 'account', 'admin', 'api', 'auth', 'blog',
    'cake-price-calculator', 'cart', 'collections', 'compare',
    'contact', 'contribute', 'customizing', 'delivery-rates',
    'designs', 'faq', 'feed', 'forgot-password', 'how-to-order',
    'login', 'order-confirmation', 'payment', 'payment-options',
    'privacy', 'return-policy', 'reviews', 'saved', 'search',
    'shop', 'signup', 'sitemap-html', 'sitemap-images.xml',
    'sitemap-index.xml', 'sitemap.xml', 'terms',
])

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Edge Rate Limiting check
    const isAiRoute = pathname.startsWith('/api/ai/analyze')
    const isNewsletterRoute = pathname.startsWith('/api/newsletter')
    const isContactRoute = pathname.startsWith('/api/contact')
    const isDiscountRoute = pathname.startsWith('/api/signup-discount')

    if (isAiRoute || isNewsletterRoute || isContactRoute || isDiscountRoute) {
        // Bypass rate limiting for authenticated admin requests using the pin
        if (isAiRoute) {
            const adminPin = request.headers.get('x-admin-pin')
            if (adminPin === '231323') {
                return NextResponse.next()
            }
        }

        const ip = request.headers.get('x-forwarded-for') || (request as any).ip || '127.0.0.1'
        const limitType = isAiRoute ? 'ai' : isNewsletterRoute ? 'newsletter' : isContactRoute ? 'contact' : 'discount'

        try {
            const { checkRateLimit } = await import('@/lib/security/rateLimiter')
            const rateLimitResult = await checkRateLimit(limitType, ip)

            if (!rateLimitResult.success) {
                return new NextResponse(
                    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
                        },
                    }
                )
            }
        } catch (err) {
            console.error('Rate limiting error in middleware:', err)
        }

        return NextResponse.next()
    }

    // Only handle single-segment paths like /NEW20, /ALAN99
    // Skip anything with multiple segments, file extensions, or known routes
    const match = pathname.match(/^\/([A-Za-z0-9]+)$/)
    if (!match) return NextResponse.next()

    const segment = match[1]
    if (KNOWN_ROUTES.has(segment.toLowerCase())) return NextResponse.next()

    // Check if this segment is a valid active discount code in Supabase.
    //
    // We previously used `cache: 'no-store'` which forced every unknown
    // single-segment URL to make a fresh REST call. For a site that gets
    // crawler hits on random paths, that's a TTFB tax on every 404. The
    // `next.revalidate` hint lets Next/Vercel reuse the response for 5
    // minutes — discount codes change infrequently and a worst-case 5-min
    // staleness is fine (the redirect just sends them home with a code that
    // may have just expired, which the cart will validate again anyway).
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
        if (!supabaseUrl || !supabaseKey) return NextResponse.next()

        const res = await fetch(
            `${supabaseUrl}/rest/v1/discount_codes?code=ilike.${encodeURIComponent(segment)}&is_active=eq.true&select=code&limit=1`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
                next: { revalidate: 300 },
            }
        )

        if (res.ok) {
            const data = await res.json()
            if (data.length > 0) {
                const url = request.nextUrl.clone()
                url.pathname = '/'
                url.searchParams.set('discount', data[0].code)
                return NextResponse.redirect(url, 307)
            }
        }
    } catch {
        // If Supabase check fails, fall through to normal routing
    }

    return NextResponse.next()
}

// Matcher excludes:
// - api/*           : route handlers should never run middleware (except rate limited endpoints)
// - _next/*         : Next.js internals (static, image optimizer, data)
// - favicon.ico     : browsers request this on every page
// - any path with a "." (file extensions like .xml, .txt, .json, images)
// This means middleware only runs on actual HTML page requests and rate-limited API routes.
export const config = {
    matcher: [
        '/((?!api|_next|favicon\\.ico|.*\\..*).*)',
        '/api/ai/analyze',
        '/api/newsletter',
        '/api/contact',
        '/api/signup-discount'
    ],
}
