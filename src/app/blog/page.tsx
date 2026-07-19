import { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogs } from '@/services/supabaseService';
import { Calendar, ChevronRight } from 'lucide-react';
import { BlogSchema } from '@/components/SEOSchemas';
import LazyImage from '@/components/LazyImage';
import LandingHeader from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';

export const revalidate = 3600; // Rebuild cache every 1 hour

export const metadata: Metadata = {
  title: { absolute: 'Custom Cake Ideas, Tips & Guides | Genie.ph Blog' },
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
  twitter: {
    card: 'summary_large_image',
    title: 'Custom Cake Ideas, Tips & Guides | Genie.ph Blog',
    description:
      'Read helpful guides, tips, and articles from Genie.ph — your online marketplace for custom cakes in Cebu.',
  },
};

export default async function BlogPage() {
  const { data: posts, error } = await getAllBlogs();

  if (error) {
    console.error('Error fetching blogs:', error);
  }

  // Fallback to empty array if no posts
  const blogPosts = posts || [];

  // Transform for BlogSchema (convert snake_case to camelCase)
  const schemaPosts = blogPosts.map(post => ({
    title: post.title,
    slug: post.slug,
    date: post.date,
    excerpt: post.excerpt,
    author: post.author,
    authorUrl: post.author_url
  }));

  return (
    <div id="top" className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100">
      {blogPosts.length > 0 && <BlogSchema posts={schemaPosts} />}
      <LandingHeader />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Blog
        </h1>
        <p className="text-gray-500 mb-6">
          Guides, tips, and helpful articles for your special celebrations.
        </p>

        {/* Topic tag navigation */}
        <div className="flex flex-wrap gap-2 mb-10">
          {[
            { slug: 'birthday-cakes', label: 'Birthday Cakes' },
            { slug: 'cebu-cakes', label: 'Cebu Cakes' },
            { slug: 'wedding-cakes', label: 'Wedding Cakes' },
            { slug: 'party-packages', label: 'Party Packages' },
            { slug: 'cake-comparison', label: 'Cake Comparisons' },
            { slug: 'character-cakes', label: 'Character Cakes' },
            { slug: 'graduation-cakes', label: 'Graduation Cakes' },
            { slug: 'kids-cakes', label: 'Kids Cakes' },
          ].map(({ slug, label }) => (
            <Link
              key={slug}
              href={`/blog/category/${slug}`}
              className="px-4 py-1.5 rounded-full text-sm font-medium bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {blogPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No blog posts available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-purple-100 hover:shadow-lg hover:border-purple-200 transition-all group"
              >
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  {/* Content Section */}
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

                  {/* Image Thumbnail */}
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
        )}
      </div>
      <LandingFooter />
    </div>
  );
}
