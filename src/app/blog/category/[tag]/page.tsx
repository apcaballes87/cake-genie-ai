import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import { getAllBlogs } from '@/services/supabaseService';
import LazyImage from '@/components/LazyImage';
import { BLOG_TAG_CONFIG, getBlogTagsForPost, getPopulatedBlogCategorySlugs } from '@/lib/seo/blogCategories';

export const revalidate = 3600;

interface Props {
    params: Promise<{ tag: string }>;
}

export async function generateStaticParams() {
    return Object.keys(BLOG_TAG_CONFIG).map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { tag } = await params;
    const config = BLOG_TAG_CONFIG[tag];
    if (!config) return {};

    const title = `${config.label} — Guides & Ideas | Genie.ph Blog`;
    return {
        title: { absolute: title },
        description: config.description,
        alternates: { canonical: `https://genie.ph/blog/category/${tag}` },
        openGraph: {
            title,
            description: config.description,
            url: `https://genie.ph/blog/category/${tag}`,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: config.description,
        },
    };
}

export default async function BlogCategoryPage({ params }: Props) {
    const { tag } = await params;
    const config = BLOG_TAG_CONFIG[tag];
    if (!config) notFound();

    const { data: allPosts } = await getAllBlogs();
    const posts = (allPosts || []).filter((post) =>
        getBlogTagsForPost(post.keywords || '').includes(tag)
    );
    const populatedCategories = new Set(getPopulatedBlogCategorySlugs(allPosts || []));

    if (posts.length === 0) notFound();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${config.label} — Genie.ph Blog`,
        description: config.description,
        url: `https://genie.ph/blog/category/${tag}`,
        isPartOf: { '@type': 'WebSite', name: 'Genie.ph', url: 'https://genie.ph' },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: posts.length,
            itemListElement: posts.map((post, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: post.title,
                url: `https://genie.ph/blog/${post.slug}`,
            })),
        },
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-purple-100">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        All Articles
                    </Link>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Breadcrumb */}
                <nav className="mb-6" aria-label="Breadcrumb">
                    <ol className="flex items-center gap-2 text-sm text-slate-500">
                        <li><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                        <li>/</li>
                        <li><Link href="/blog" className="hover:text-purple-600 transition-colors">Blog</Link></li>
                        <li>/</li>
                        <li className="text-slate-800 font-medium">{config.label}</li>
                    </ol>
                </nav>

                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    {config.label}
                </h1>
                <p className="text-gray-500 mb-10">{config.description}</p>

                <div className="space-y-6">
                    {posts.map((post) => (
                        <Link
                            key={post.slug}
                            href={`/blog/${post.slug}`}
                            className="block bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-purple-100 hover:shadow-lg hover:border-purple-200 transition-all group"
                        >
                            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                                <div className="flex-1">
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
                                    <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
                                        {post.title}
                                    </h2>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-4">
                                        {post.excerpt}
                                    </p>
                                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-purple-600 group-hover:gap-2 transition-all">
                                        Read more <ChevronRight size={16} />
                                    </span>
                                </div>
                                {post.image && (
                                    <div className="md:w-48 md:h-32 shrink-0 overflow-hidden rounded-xl relative">
                                        <LazyImage
                                            src={post.image}
                                            alt={post.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 192px"
                                            imageClassName="object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Related categories */}
                <div className="mt-12 pt-8 border-t border-purple-100">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Browse More Topics</h2>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(BLOG_TAG_CONFIG)
                            .filter(([slug]) => populatedCategories.has(slug))
                            .filter(([slug]) => slug !== tag)
                            .map(([slug, cfg]) => (
                                <Link
                                    key={slug}
                                    href={`/blog/category/${slug}`}
                                    className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
                                >
                                    {cfg.label}
                                </Link>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
