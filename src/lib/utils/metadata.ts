import type { Metadata } from 'next';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';

const SITE_NAME = 'Genie.ph';
const DEFAULT_OG_IMAGE = {
    url: genieBusinessProfile.ogImageUrl,
    width: 1200,
    height: 630,
    alt: 'Genie.ph - Custom Cakes Online',
};

function withSiteName(title: string): string {
    return `${title} | ${SITE_NAME}`;
}

export function buildMarketingPageMetadata({
    title,
    description,
    canonicalPath,
    socialImage = DEFAULT_OG_IMAGE,
}: {
    title: string;
    description: string;
    canonicalPath: string;
    socialImage?: {
        url: string;
        width: number;
        height: number;
        alt: string;
    };
}): Metadata {
    const fullTitle = withSiteName(title);

    return {
        title: { absolute: fullTitle },
        description,
        alternates: {
            canonical: canonicalPath,
        },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url: canonicalPath,
            images: [socialImage],
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: [socialImage],
        },
    };
}

export function buildNoIndexPageMetadata({
    title,
    description,
    canonicalPath,
    follow = false,
}: {
    title: string;
    description: string;
    /** Optional canonical URL. Use when this page has a preferred URL that
     *  should be signalled to crawlers even though it is not indexed. */
    canonicalPath?: string;
    follow?: boolean;
}): Metadata {
    const fullTitle = withSiteName(title);

    return {
        title: { absolute: fullTitle },
        description,
        ...(canonicalPath ? { alternates: { canonical: canonicalPath } } : {}),
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            images: [DEFAULT_OG_IMAGE],
        },
        robots: {
            index: false,
            follow,
            googleBot: {
                index: false,
                follow,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: [DEFAULT_OG_IMAGE],
        },
    };
}
