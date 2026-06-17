import Link from 'next/link';
import { resolveBlogCommercialLinks } from '@/lib/utils/blogCommercialLinks';
import { getOptimizedSupabaseImageSrc } from '@/lib/utils/supabaseImageUrl';
import { formatStartingPrice } from '@/lib/utils/currency';

interface BlogDesignShowcaseProduct {
  p_hash: string;
  original_image_url: string;
  price?: number | null;
  availability?: string | null;
  slug?: string | null;
  keywords?: string | null;
  alt_text?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  analysis_json?: any;
}

interface BlogDesignShowcaseSectionProps {
  title: string;
  intro?: string;
  keyword: string;
  products: BlogDesignShowcaseProduct[];
}

const getProductLabel = (product: BlogDesignShowcaseProduct, sectionKeyword?: string) =>
  product.alt_text?.trim() || product.keywords?.split(',')[0]?.trim() || (sectionKeyword ? `Custom ${sectionKeyword} cake design` : 'Custom cake design idea');

const getProductTitle = (product: BlogDesignShowcaseProduct) => {
  const t = product.keywords ? product.keywords.split(',')[0] : 'Custom Cake';
  const formatted = t.trim().toLowerCase().endsWith('cake') ? t.trim() : `${t.trim()} Cake`;
  return formatted
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getProductDimensions = (product: BlogDesignShowcaseProduct) => ({
  width: product.image_width && product.image_width > 0 ? product.image_width : 800,
  height: product.image_height && product.image_height > 0 ? product.image_height : 1000,
});

export function BlogDesignShowcaseSection({
  title,
  intro,
  keyword,
  products,
}: BlogDesignShowcaseSectionProps) {
  if (products.length === 0) {
    return null;
  }

  const commercialLinks = resolveBlogCommercialLinks({ title, keyword });

  return (
    <section className="mt-12">
      <div className="mb-5 space-y-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 md:text-2xl">{title}</h2>
          {intro && <p className="max-w-2xl text-sm leading-relaxed text-gray-500">{intro}</p>}
        </div>
      </div>

      <div className="columns-2 md:columns-3 lg:columns-5 xl:columns-6" style={{ columnGap: '0.75rem' }}>
        {products.map((product, index) => {
          const label = getProductLabel(product, keyword);
          const productTitle = getProductTitle(product);
          const imageSrc =
            getOptimizedSupabaseImageSrc(product.original_image_url, product.image_width ?? 800) ||
            product.original_image_url;
          const { width, height } = getProductDimensions(product);

          const card = (
            <div className="group mb-5 break-inside-avoid flex flex-col h-full">
              <div
                className={`w-full overflow-hidden rounded-2xl border border-purple-100 bg-gray-50 shadow-sm mb-1.5 ${product.image_width && product.image_height ? '' : 'aspect-4/5'}`}
                style={
                  product.image_width && product.image_height
                    ? { aspectRatio: `${product.image_width} / ${product.image_height}` }
                    : undefined
                }
              >
                <img
                  src={imageSrc}
                  alt={label}
                  title={label}
                  width={width}
                  height={height}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="px-0 pb-1 pt-0.5 flex flex-col flex-1 text-left">
                <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                  {productTitle}
                </h3>
                <p className="text-xs text-gray-500">
                  {formatStartingPrice(product.price, product.analysis_json?.cakeType)}
                </p>
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
              className="block focus:outline-none"
            >
              {card}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Link
          href={commercialLinks.primary.href}
          className="inline-flex items-center justify-center rounded-full border border-purple-200 bg-white px-6 py-3 text-sm font-semibold text-purple-600 shadow-sm transition-all hover:bg-purple-50 hover:text-purple-800 hover:shadow-md"
        >
          {commercialLinks.primary.label}
        </Link>
      </div>
    </section>
  );
}