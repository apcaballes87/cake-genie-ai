import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    console.log('Middleware running for:', request.nextUrl.pathname)

    // 1. WWW to Non-WWW Redirect - REMOVED due to conflict with Vercel settings
    // const host = request.headers.get('host') || ''
    // if (host.startsWith('www.')) {
    //     const newHost = host.replace('www.', '')
    //     const url = request.nextUrl.clone()
    //     url.host = newHost
    //     url.protocol = 'https'
    //     return NextResponse.redirect(url, 301)
    // }

    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Do not add any logic between createServerClient and getUser()
    await supabase.auth.getUser()

    // CSP and Security Headers
    // Using protocol-based CSP to avoid header length limits while maintaining security
    const cspHeader = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.googletagmanager.com https://*.clarity.ms https://*.bing.com https://*.tawk.to https://*.google.com http://*.google.com https://*.adtrafficquality.google; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to https://*.google.com; img-src 'self' data: blob: https: http://*.google.com; connect-src 'self' https: wss:; font-src 'self' data: https:; frame-src 'self' https:; worker-src 'self' blob:;`

    supabaseResponse.headers.set('Content-Security-Policy', cspHeader)
    supabaseResponse.headers.set('X-Frame-Options', 'SAMEORIGIN')
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
    supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
