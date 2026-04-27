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

    // --- A/B Testing Logic ---
    // Only apply to landing page for now to keep it simple, but we can expand later
    let variant = request.cookies.get('ab-test-landing')?.value;
    let cookieToSet: string | null = null;

    if (!variant) {
        variant = Math.random() < 0.5 ? 'control' : 'variant-b';
        cookieToSet = variant;
    }

    // Helper to add A/B test info to any response
    const withABTest = (res: NextResponse) => {
        res.headers.set('x-ab-variant', variant!);
        if (cookieToSet) {
            res.cookies.set('ab-test-landing', cookieToSet, {
                path: '/',
                maxAge: 60 * 60 * 24 * 30, // 30 days
            });
        }
        return res;
    }
    // -------------------------

    // Only handle single-segment paths like /NEW20, /ALAN99
    // Skip anything with multiple segments, file extensions, or known routes
    const match = pathname.match(/^\/([A-Za-z0-9]+)$/)
    if (!match) return withABTest(NextResponse.next())

    const segment = match[1]
    if (KNOWN_ROUTES.has(segment.toLowerCase())) return withABTest(NextResponse.next())

    // Check if this segment is a valid active discount code in Supabase
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseKey) return withABTest(NextResponse.next())

        const res = await fetch(
            `${supabaseUrl}/rest/v1/discount_codes?code=ilike.${encodeURIComponent(segment)}&is_active=eq.true&select=code&limit=1`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
                cache: 'no-store',
            }
        )

        if (res.ok) {
            const data = await res.json()
            if (data.length > 0) {
                const url = request.nextUrl.clone()
                url.pathname = '/'
                url.searchParams.set('discount', data[0].code)
                return withABTest(NextResponse.redirect(url, 307))
            }
        }
    } catch {
        // If Supabase check fails, fall through to normal routing
    }

    return withABTest(NextResponse.next())
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
