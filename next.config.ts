import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cqmhanqnfybyxezhobkx.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'es.pinterest.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: 'https://cqmhanqnfybyxezhobkx.supabase.co/functions/v1/generate-sitemap',
      },
    ]
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
