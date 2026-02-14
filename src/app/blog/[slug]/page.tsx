import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPostBySlug, getAllBlogPosts } from '@/data/blogPosts';
import { ArrowLeft, Calendar } from 'lucide-react';
import { BlogContent } from './BlogContent';
import { BlogPostingSchema } from '@/components/SEOSchemas';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: 'Post Not Found | Genie.ph' };

  return {
    title: `${post.title} | Genie.ph Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://genie.ph/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      images: post.image ? [post.image] : [],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100">
      <BlogPostingSchema
        headline={post.title}
        datePublished={post.date}
        authorName={post.author}
        image={post.image}
        description={post.excerpt}
      />
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

        {/* Post Content */}
        <BlogContent content={post.content} />
      </article>
    </div>
  );
}
