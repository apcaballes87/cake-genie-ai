/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import LazyImage from './LazyImage';
import type { VariantManifest } from '@/lib/imageVariants/types';

// next/image triggers warnings about width/height when fill is used with
// remotePatterns; mock it to render a plain <img> so we can assert on the
// DOM directly. We reproduce just enough of the next/image surface that
// LazyImage's prop spread compiles.
vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => {
        const { src, alt, srcSet, sizes, fetchPriority, ...rest } = props as {
            src: string;
            alt: string;
            srcSet?: string;
            sizes?: string;
            fetchPriority?: string;
            [k: string]: unknown;
        };
        // Drop next/image-only props that React rejects on a real <img>.
        const { fill, priority, unoptimized, loader, placeholder, blurDataURL, quality, ...imgProps } = rest as Record<string, unknown>;
        void fill;
        void priority;
        void unoptimized;
        void loader;
        void placeholder;
        void blurDataURL;
        void quality;
        return (
            <img
                src={src}
                alt={alt}
                {...(srcSet ? { srcSet } : {})}
                {...(sizes ? { sizes } : {})}
                {...(fetchPriority ? { fetchPriority } : {})}
                {...imgProps}
            />
        );
    },
}));

const url400 = 'https://x.example.com/variants/abc/400.webp';
const url800 = 'https://x.example.com/variants/abc/800.webp';
const url1200 = 'https://x.example.com/variants/abc/1200.webp';

const fullManifest: VariantManifest = {
    format: 'webp',
    source: 'studio_edited_image_url',
    variants: [
        { width: 400, url: url400, bytes: 12000 },
        { width: 800, url: url800, bytes: 24000 },
        { width: 1200, url: url1200, bytes: 36000 },
    ],
};

describe('LazyImage', () => {
    it('renders without a <picture> wrapper when variants is undefined (existing behavior)', () => {
        const { container } = render(
            <LazyImage src="https://x.example.com/original.jpg" alt="cake" />,
        );
        expect(container.querySelector('picture')).toBeNull();
        expect(container.querySelector('img')).not.toBeNull();
    });

    it('renders without a <picture> wrapper when variants is null', () => {
        const { container } = render(
            <LazyImage src="https://x.example.com/original.jpg" alt="cake" variants={null} />,
        );
        expect(container.querySelector('picture')).toBeNull();
    });

    it('renders without a <picture> wrapper when variants has zero entries', () => {
        const empty: VariantManifest = {
            format: 'webp',
            source: 'original_image_url',
            variants: [],
        };
        const { container } = render(
            <LazyImage src="https://x.example.com/original.jpg" alt="cake" variants={empty} />,
        );
        expect(container.querySelector('picture')).toBeNull();
    });

    it('wraps the <img> in <picture> with a webp <source srcset> when variants are provided (Req 6.1)', () => {
        const { container } = render(
            <LazyImage src="https://x.example.com/original.jpg" alt="cake" variants={fullManifest} />,
        );

        const picture = container.querySelector('picture');
        expect(picture).not.toBeNull();

        const source = picture!.querySelector('source');
        expect(source).not.toBeNull();
        expect(source!.getAttribute('type')).toBe('image/webp');

        const srcset = source!.getAttribute('srcset');
        expect(srcset).toContain(`${url400} 400w`);
        expect(srcset).toContain(`${url800} 800w`);
        expect(srcset).toContain(`${url1200} 1200w`);

        // The visible <img> falls back to the largest variant ≤ 1200 (Req 6.5).
        const img = picture!.querySelector('img');
        expect(img).not.toBeNull();
        expect(img!.getAttribute('src')).toBe(url1200);
    });

    it('forwards the sizes attribute to both <source> and <img>', () => {
        const customSizes = '(max-width: 640px) 92vw, 800px';
        const { container } = render(
            <LazyImage
                src="https://x.example.com/original.jpg"
                alt="cake"
                variants={fullManifest}
                sizes={customSizes}
            />,
        );

        const source = container.querySelector('picture > source');
        expect(source!.getAttribute('sizes')).toBe(customSizes);

        const img = container.querySelector('picture > img');
        expect(img!.getAttribute('sizes')).toBe(customSizes);
    });

    it('falls back to the smallest variant when every variant exceeds maxWidth (single-variant manifest)', () => {
        const singleHugeVariant: VariantManifest = {
            format: 'webp',
            source: 'original_image_url',
            variants: [{ width: 2400, url: 'https://x.example.com/2400.webp', bytes: 200000 }],
        };
        const { container } = render(
            <LazyImage
                src="https://x.example.com/original.jpg"
                alt="cake"
                variants={singleHugeVariant}
            />,
        );
        // pickFallbackSrc with default maxWidth=1200 returns the only available
        // variant (2400) since there's nothing smaller.
        const img = container.querySelector('img');
        expect(img!.getAttribute('src')).toBe('https://x.example.com/2400.webp');
    });

    it('can keep an image visible before onLoad when showBeforeLoad is set', () => {
        const { container } = render(
            <LazyImage
                src="https://x.example.com/original.jpg"
                alt="cake"
                showBeforeLoad
            />,
        );

        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img!.className).toContain('opacity-100');
        expect(img!.className).toContain('duration-0');
    });
});
