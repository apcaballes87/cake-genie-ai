import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/account/',
                    '/admin/',
                    '/api/',
                    '/_next/',
                    '/cart/',
                    '/saved/',
                    '/payment/',
                    '/order-confirmation/',
                    '/login',
                    '/signup',
                    '/forgot-password/',
                    '/auth/',
                    '/search',
                    '/customizing?*',
                    '/customizing/*?*',
                ],
            },
            // Explicitly allow AI crawlers for GEO (Generative Engine Optimization)
            {
                userAgent: ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'OAI-SearchBot', 'Bytespider'],
                allow: '/',
                disallow: [
                    '/admin/',
                    '/api/',
                    '/account/',
                    '/_next/',
                    '/customizing?*',
                    '/customizing/*?*',
                ],
            },
            // Meta's sharing/debugger crawlers use several identifiers in the wild.
            // Let them fetch customizer query URLs so Facebook can read the same OG tags
            // as the canonical clean slug page.
            {
                userAgent: ['facebookexternalhit', 'Facebot', 'FacebookBot', 'meta-externalagent'],
                allow: '/',
                disallow: [
                    '/admin/',
                    '/api/',
                    '/account/',
                    '/_next/',
                ],
            },
        ],
        sitemap: 'https://genie.ph/sitemap.xml',
    }
}
