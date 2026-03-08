import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Only our own Supabase domains need optimization via next/image.
  // All other external domains are handled by LazyImage with unoptimized={true}.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cqmhanqnfybyxezhobkx.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'congofivupobtfudnhni.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pinimg.com',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'cakesandmemories.com',
      },
    ],
  },
  // Sitemap is now served by Next.js via src/app/sitemap.ts
  // The old Supabase Edge Function (generate-sitemap) is no longer used

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/sitemap-index.xml',
      },
      { source: '/sitemap-core.xml', destination: '/sitemap/0.xml' },
      { source: '/sitemap-bakeries.xml', destination: '/sitemap/1.xml' },
      { source: '/sitemap-products.xml', destination: '/sitemap/2.xml' },
      { source: '/sitemap-blog.xml', destination: '/sitemap/3.xml' },
      { source: '/sitemap-designs-:id.xml', destination: '/sitemap/designs-:id.xml' },
      { source: '/sitemap-customized-cakes-:id.xml', destination: '/sitemap/customized-cakes-:id.xml' },
    ];
  },

  async redirects() {
    return [
      // Redirect old /merchant/ URLs to /shop/
      {
        source: '/merchant/:merchantSlug',
        destination: '/shop/:merchantSlug',
        permanent: true,
      },
      {
        source: '/merchant/:merchantSlug/:productSlug',
        destination: '/shop/:merchantSlug/:productSlug',
        permanent: true,
      },
      // Redirect old category slugs to real indexed category pages
      {
        source: '/customizing/birthday',
        destination: '/customizing/category/birthday-cakes',
        permanent: true,
      },
      {
        source: '/customizing/wedding',
        destination: '/customizing/category/wedding-cakes',
        permanent: true,
      },
      {
        source: '/customizing/graduation',
        destination: '/customizing/category/graduation-cakes',
        permanent: true,
      },
      {
        source: '/customizing/anniversary',
        destination: '/customizing/category/anniversary-cakes',
        permanent: true,
      },
      {
        source: '/customizing/christening',
        destination: '/customizing/category/christening-cakes',
        permanent: true,
      },
    ]
  },
  // Remove console.log in production builds for cleaner output
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error and warn for debugging
    } : false,
  },
}

export default nextConfig
