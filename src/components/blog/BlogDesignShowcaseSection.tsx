'use client';

import React from 'react';
import Link from 'next/link';
import Masonry from 'react-masonry-css';
import LazyImage from '@/components/LazyImage';

interface BlogDesignShowcaseProduct {
  p_hash: string;
  original_image_url: string;
  slug?: string | null;
  keywords?: string | null;
  alt_text?: string | null;
  image_width?: number | null;
  image_height?: number | null;
}

interface BlogDesignShowcaseSectionProps {
  title: string;
  intro?: string;
  keyword: string;
  products: BlogDesignShowcaseProduct[];
}

const getProductLabel = (product: BlogDesignShowcaseProduct) =>
  product.alt_text?.trim() || product.keywords?.split(',')[0]?.trim() || 'Cake design';

export function BlogDesignShowcaseSection({
  title,
  intro,
  keyword,
  products,
}: BlogDesignShowcaseSectionProps) {
  if (products.length === 0) {
    return null;
  }

  const searchHref = `/search?q=${encodeURIComponent(keyword)}`;

  return (
    <section className="mt-12">
      <div className="mb-5 space-y-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 md:text-2xl">{title}</h2>
          {intro && <p className="max-w-2xl text-sm leading-relaxed text-gray-500">{intro}</p>}
        </div>
      </div>

      <Masonry
        breakpointCols={{ default: 6, 1024: 5, 768: 3 }}
        className="-ml-2 flex w-auto md:-ml-3"
        columnClassName="pl-2 md:pl-3 bg-clip-padding"
      >
        {products.map((product, index) => {
          const label = getProductLabel(product);
          const card = (
            <div className="group relative mb-2 overflow-hidden rounded-2xl border border-purple-100 bg-gray-50 shadow-sm md:mb-3">
              <div
                className={`relative w-full ${product.image_width && product.image_height ? '' : 'aspect-4/5'}`}
                style={
                  product.image_width && product.image_height
                    ? { aspectRatio: `${product.image_width} / ${product.image_height}` }
                    : undefined
                }
              >
                <LazyImage
                  src={product.original_image_url}
                  alt={label}
                  title={label}
                  fill
                  sizes="(max-width: 768px) 33vw, (max-width: 1024px) 20vw, 16vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>
          );

          if (!product.slug) {
            return <div key={`${product.p_hash}-${index}`}>{card}</div>;
          }

          return (
            <Link
              key={`${product.slug}-${index}`}
              href={`/customizing/${product.slug}`}
              aria-label={label}
              className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
            >
              {card}
            </Link>
          );
        })}
      </Masonry>

      <div className="mt-6 flex justify-center">
        <Link
          href={searchHref}
          className="inline-flex items-center justify-center rounded-full border border-purple-200 bg-white px-6 py-3 text-sm font-semibold text-purple-600 shadow-sm transition-all hover:bg-purple-50 hover:text-purple-800 hover:shadow-md"
        >
          View More Designs
        </Link>
      </div>
    </section>
  );
}