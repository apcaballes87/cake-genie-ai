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
            // Explicitly allow AI crawlers for GEO
            {
                userAgent: ['GPTBot', 'ClaudeBot', 'Google-Extended'],
                allow: '/',
                disallow: ['/admin/', '/api/', '/account/'],
            },
        ],
        sitemap: 'https://genie.ph/sitemap.xml',
    }
}
