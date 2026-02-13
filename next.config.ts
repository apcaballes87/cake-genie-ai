import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Only our own Supabase domains need optimization via next/image.
  // All other external domains are handled by LazyImage with unoptimized={true}.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cqmhanqnfybyxezhobkx.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'congofivupobtfudnhni.supabase.co',
      },
    ],
  },
  // Sitemap is now served by Next.js via src/app/sitemap.ts
  // The old Supabase Edge Function (generate-sitemap) is no longer used

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
      // Redirect old category slugs to search page
      {
        source: '/customizing/birthday',
        destination: '/search?q=birthday',
        permanent: true,
      },
      {
        source: '/customizing/wedding',
        destination: '/search?q=wedding',
        permanent: true,
      },
      {
        source: '/customizing/graduation',
        destination: '/search?q=graduation',
        permanent: true,
      },
      {
        source: '/customizing/anniversary',
        destination: '/search?q=anniversary',
        permanent: true,
      },
      {
        source: '/customizing/christening',
        destination: '/search?q=christening',
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
