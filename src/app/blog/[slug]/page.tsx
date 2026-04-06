import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogBySlug, getAllBlogSlugs } from '@/services/supabaseService';
import { ArrowLeft, Calendar } from 'lucide-react';
import { BlogContent } from './BlogContent';
import { BlogPostingSchema, BlogBreadcrumbSchema } from '@/components/SEOSchemas';
import { getRelatedProductsByKeywords } from '@/services/supabaseService';
import { RelatedProductsSection } from '@/components/blog/RelatedProductsSection';
import { BlogDesignShowcaseSection } from '@/components/blog/BlogDesignShowcaseSection';
import LazyImage from '@/components/LazyImage';
import NewsletterPopup from '@/components/NewsletterPopup';
import {
  getBlogDesignShowcaseConfigs,
  splitBlogContentByShowcasePlaceholders,
} from '@/components/blog/getBlogDesignShowcase';

export const revalidate = 3600; // Rebuild cached post pages every 1 hour

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

interface BlogRelatedProduct {
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

export async function generateStaticParams() {
  const { data: slugs } = await getAllBlogSlugs();

  if (!slugs) {
    return [];
  }

  return slugs.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: post } = await getBlogBySlug(slug);

  if (!post) {
    return { title: { absolute: 'Post Not Found | Genie.ph' } };
  }

  const pageTitle = post.title.includes('Genie.ph') ? post.title : `${post.title} | Genie.ph`;

  const keywords = post.keywords ? post.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [];

  return {
    title: { absolute: pageTitle },
    description: post.excerpt,
    alternates: {
      canonical: `https://genie.ph/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://genie.ph/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.updated_at,
      authors: [post.author],
      tags: keywords.length > 0 ? keywords : undefined,
      images: post.image ? [{ url: post.image, width: 1200, height: 630, alt: post.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.image ? [{ url: post.image, width: 1200, height: 630, alt: post.title }] : [],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const { data: post } = await getBlogBySlug(slug);

  if (!post) {
    notFound();
  }

  const showcaseConfigs = getBlogDesignShowcaseConfigs(post);
  const contentSegments = splitBlogContentByShowcasePlaceholders(post.content);

  let relatedDesigns: BlogRelatedProduct[] = [];
  const showcaseProductsById = new Map<string, BlogRelatedProduct[]>();

  const [relatedResult, ...showcaseResults] = await Promise.allSettled([
    getRelatedProductsByKeywords(
      post.cake_search_keywords || post.keywords || post.title,
      slug,
      8,
      0
    ),
    ...showcaseConfigs.map((showcaseConfig) =>
      getRelatedProductsByKeywords(showcaseConfig.keyword, slug, 18, 0)
    ),
  ]);

  if (relatedResult.status === 'fulfilled') {
    relatedDesigns = relatedResult.value.data || [];
  } else {
    console.error('Error fetching related designs:', relatedResult.reason);
  }

  showcaseConfigs.forEach((showcaseConfig, index) => {
    const showcaseResult = showcaseResults[index];

    if (showcaseResult?.status === 'fulfilled') {
      showcaseProductsById.set(showcaseConfig.id, showcaseResult.value.data || []);
      return;
    }

    console.error(`Error fetching blog design showcase: ${showcaseConfig.id}`, showcaseResult);
    showcaseProductsById.set(showcaseConfig.id, []);
  });

  const showcaseConfigById = new Map(showcaseConfigs.map((config) => [config.id, config]));
  const placeholderShowcaseIds = new Set(
    contentSegments
      .filter((segment) => segment.type === 'showcase' && segment.showcaseId)
      .map((segment) => segment.showcaseId as string)
  );
  const trailingShowcases = showcaseConfigs.filter((config) => {
    const products = showcaseProductsById.get(config.id) || [];
    return !placeholderShowcaseIds.has(config.id) && products.length > 0;
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100">
      <BlogPostingSchema
        headline={post.title}
        datePublished={post.date}
        dateModified={post.updated_at}
        authorName={post.author}
        authorUrl={post.author_url}
        image={post.image}
        imageWidth={1200}
        imageHeight={630}
        imageAlt={post.title}
        description={post.excerpt}
        url={`https://genie.ph/blog/${post.slug}`}
      />
      <BlogBreadcrumbSchema postTitle={post.title} postSlug={post.slug} />
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 transition-colors"
          >
            <ArrowLeft size={16} />
            All Posts
          </Link>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 py-10">
        {/* Post Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Calendar size={14} />
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="text-gray-300">|</span>
            <span>{post.author}</span>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            {post.title}
          </h1>
        </header>

        {/* Featured Image */}
        {post.image && (
          <figure className="mb-8">
            <LazyImage
              src={post.image}
              alt={post.title}
              title={post.title}
              width={1200}
              height={630}
              sizes="(max-width: 768px) 100vw, 768px"
              priority
              fetchPriority="high"
              className="w-full rounded-xl shadow-md"
              imageClassName="h-auto w-full rounded-xl"
            />
            <figcaption className="mt-2 text-sm text-gray-500">
              {post.title}
            </figcaption>
          </figure>
        )}

        {/* Post Content + inline showcase blocks */}
        {contentSegments.map((segment, index) => {
          if (segment.type === 'content' && segment.content) {
            return (
              <div key={`content-${index}`}>
                <BlogContent content={segment.content} />
              </div>
            );
          }

          if (segment.type === 'showcase' && segment.showcaseId) {
            const showcaseConfig = showcaseConfigById.get(segment.showcaseId);
            const showcaseDesigns = showcaseProductsById.get(segment.showcaseId) || [];

            if (!showcaseConfig || showcaseDesigns.length === 0) {
              return null;
            }

            return (
              <BlogDesignShowcaseSection
                key={`showcase-${segment.showcaseId}-${index}`}
                title={showcaseConfig.title}
                intro={showcaseConfig.intro}
                keyword={showcaseConfig.keyword}
                products={showcaseDesigns}
              />
            );
          }

          return null;
        })}

        {trailingShowcases.map((showcaseConfig) => {
          const showcaseDesigns = showcaseProductsById.get(showcaseConfig.id) || [];

          return (
            <BlogDesignShowcaseSection
              key={`showcase-trailing-${showcaseConfig.id}`}
              title={showcaseConfig.title}
              intro={showcaseConfig.intro}
              keyword={showcaseConfig.keyword}
              products={showcaseDesigns}
            />
          );
        })}

        {/* Related Designs Section */}
        {relatedDesigns && relatedDesigns.length > 0 && (
          <RelatedProductsSection
            initialProducts={relatedDesigns}
            keyword={post.cake_search_keywords || post.keywords || post.title}
            slug={slug}
            postTitle={post.title}
            intro={post.related_cakes_intro}
          />
        )}
      </article>
      <NewsletterPopup />
    </div>
  );
}
