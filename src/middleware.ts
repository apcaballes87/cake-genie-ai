import { NextResponse, type NextRequest } from 'next/server'
import { upgradeLegacySlug } from '@/lib/utils/urlHelpers'
import {
    INTERNAL_TRAFFIC_COOKIE_MAX_AGE_SECONDS,
    INTERNAL_TRAFFIC_COOKIE_NAME,
    INTERNAL_TRAFFIC_COOKIE_VALUE,
    shouldMarkInternalTraffic,
} from '@/lib/analyticsRoutes'

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

// Known malicious bot user agents (SEO scrapers, spam bots)
// NOTE: AI crawlers (GPTBot, ClaudeBot, PerplexityBot) are NOT blocked — they help GEO
const BLOCKED_USER_AGENTS = [
    'semrush', 'ahrefs', 'mj12bot', 'dotbot', 'blexbot',
    'screaming frog', 'petalbot', 'yandex',
]

// Rate limiting store (in-memory, resets on cold start)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 60 // max requests per window
const CUSTOMIZING_SHORT_HASH_ALIAS_RE = /^\/customizing\/([^/]*-[a-f0-9]{4})\/?$/i

function withInternalTrafficCookie(pathname: string, response: NextResponse): NextResponse {
    if (!shouldMarkInternalTraffic(pathname)) {
        return response
    }

    response.cookies.set({
        name: INTERNAL_TRAFFIC_COOKIE_NAME,
        value: INTERNAL_TRAFFIC_COOKIE_VALUE,
        path: '/',
        maxAge: INTERNAL_TRAFFIC_COOKIE_MAX_AGE_SECONDS,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    })

    return response
}

function checkIpRateLimit(ip: string): boolean {
    const now = Date.now()
    const record = rateLimitStore.get(ip)

    if (!record || now > record.resetTime) {
        rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
        return true
    }

    record.count++
    return record.count <= RATE_LIMIT_MAX
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    const customizerAliasMatch = pathname.match(CUSTOMIZING_SHORT_HASH_ALIAS_RE)
    if (customizerAliasMatch) {
        const slug = customizerAliasMatch[1]
        const upgradedSlug = upgradeLegacySlug(slug)

        if (upgradedSlug !== slug) {
            const url = request.nextUrl.clone()
            url.pathname = `/customizing/${upgradedSlug}`
            return NextResponse.redirect(url, 308)
        }
    }

    // === BOT BLOCKING ===
    const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
    const referer = request.headers.get('referer') || ''
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

    // Block known malicious bot user agents
    for (const bot of BLOCKED_USER_AGENTS) {
        if (userAgent.includes(bot)) {
            return new NextResponse('Forbidden', { status: 403 })
        }
    }

    // Block requests with no user agent (common for bots)
    if (!userAgent) {
        return new NextResponse('Forbidden', { status: 403 })
    }

    // Block suspicious patterns: no referer + fast repeated requests
    // This catches bots that hit multiple pages without referrer
    if (!referer && !pathname.startsWith('/api/')) {
        if (!checkIpRateLimit(ip)) {
            return new NextResponse('Too Many Requests', {
                status: 429,
                headers: { 'Retry-After': '60' },
            })
        }
    }

    // === END BOT BLOCKING ===

    // Edge Rate Limiting check
    const isAiRoute = pathname.startsWith('/api/ai/analyze') || pathname.startsWith('/api/ai/edit-image')
    const isNewsletterRoute = pathname.startsWith('/api/newsletter')
    const isContactRoute = pathname.startsWith('/api/contact')
    const isDiscountRoute = pathname.startsWith('/api/signup-discount')

    if (isAiRoute || isNewsletterRoute || isContactRoute || isDiscountRoute) {
        // Bypass rate limiting for authenticated admin requests using the pin
        if (pathname.startsWith('/api/ai/analyze')) {
            const adminPin = request.headers.get('x-admin-pin')
            if (adminPin === '231323') {
                return NextResponse.next()
            }
        }

        const requestWithOptionalIp = request as NextRequest & { ip?: string }
        const ip = request.headers.get('x-forwarded-for') || requestWithOptionalIp.ip || '127.0.0.1'
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
    if (!match) return withInternalTrafficCookie(pathname, NextResponse.next())

    const segment = match[1]
    if (KNOWN_ROUTES.has(segment.toLowerCase())) return withInternalTrafficCookie(pathname, NextResponse.next())

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

    return withInternalTrafficCookie(pathname, NextResponse.next())
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
        '/api/ai/edit-image',
        '/api/newsletter',
        '/api/contact',
        '/api/signup-discount'
    ],
}
