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
                    '/cart/',
                    '/saved/',
                    '/payment/',
                    '/order-confirmation/',
                    '/login',
                    '/signup',
                    '/forgot-password/',
                    '/auth/',
                    '/search',
                ],
            },
            // Explicitly allow AI crawlers for GEO (Generative Engine Optimization)
            {
                userAgent: ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'OAI-SearchBot', 'Bytespider'],
                allow: '/',
                disallow: ['/admin/', '/api/', '/account/'],
            },
        ],
        sitemap: 'https://genie.ph/sitemap.xml',
    }
}
