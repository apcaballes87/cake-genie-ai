import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/customizing/*?caketype=*'],
                disallow: [
                    '/account/',
                    '/admin/',
                    '/api/',
                    '/cart/',
                    '/saved/',
                    '/payment/',
                    '/login',
                    '/signup',
                    '/auth/callback',
                    '/customizing?*',
                    '/customizing/*?*',
                ],
            },
            // Explicitly allow AI crawlers for GEO (Generative Engine Optimization)
            {
                userAgent: ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'OAI-SearchBot', 'Bytespider'],
                allow: ['/', '/customizing/*?caketype=*'],
                disallow: [
                    '/admin/',
                    '/api/',
                    '/account/',
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
                ],
            },
        ],
        sitemap: [
            'https://genie.ph/sitemap.xml',
            'https://genie.ph/sitemap-index.xml',
            'https://genie.ph/sitemap-images.xml',
        ],
    }
}
