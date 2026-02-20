import { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts } from '@/data/blogPosts';
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import { BlogSchema } from '@/components/SEOSchemas';

export const metadata: Metadata = {
  title: 'Custom Cake Ideas, Tips & Guides | Genie.ph Blog',
  description:
    'Read helpful guides, tips, and articles from Genie.ph — your online marketplace for custom cakes in Cebu.',
  alternates: {
    canonical: 'https://genie.ph/blog',
  },
  openGraph: {
    title: 'Custom Cake Ideas, Tips & Guides | Genie.ph Blog',
    description:
      'Read helpful guides, tips, and articles from Genie.ph — your online marketplace for custom cakes in Cebu.',
    url: 'https://genie.ph/blog',
    type: 'website',
  },
};

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100">
      <BlogSchema posts={posts} />
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Blog
        </h1>
        <p className="text-gray-500 mb-10">
          Guides, tips, and helpful articles for your special celebrations.
        </p>

        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-purple-100 hover:shadow-lg hover:border-purple-200 transition-all group"
            >
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
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
