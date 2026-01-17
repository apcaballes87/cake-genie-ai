import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/account/',
                '/admin/',
                '/api/',
                '/customizing/',
                '/cart/',
                '/saved/',
                '/payment/',
                '/order-confirmation/',
                '/login',
                '/signup',
                '/forgot-password',
                '/auth/',
                '/search',
            ],
        },
        sitemap: 'https://genie.ph/sitemap.xml',
    }
}
