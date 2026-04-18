import { NextResponse } from 'next/server'

// RFC 9727: /.well-known/api-catalog serves a linkset describing
// discoverable, public, agent-useful resources on this origin.
// Media type: application/linkset+json (RFC 9264).
export function GET() {
  const origin = 'https://genie.ph'

  const body = {
    linkset: [
      {
        anchor: `${origin}/`,
        'service-doc': [
          {
            href: `${origin}/llms.txt`,
            type: 'text/plain',
            title: 'Site description for LLMs and agents',
          },
          {
            href: `${origin}/how-to-order`,
            type: 'text/html',
            title: 'How to order a custom cake',
          },
        ],
        sitemap: [
          {
            href: `${origin}/sitemap.xml`,
            type: 'application/xml',
            title: 'Main sitemap index',
          },
          {
            href: `${origin}/sitemap-images.xml`,
            type: 'application/xml',
            title: 'Image sitemap',
          },
        ],
        related: [
          {
            href: `${origin}/cake-price-calculator`,
            type: 'text/html',
            title: 'AI cake price calculator',
          },
          {
            href: `${origin}/collections`,
            type: 'text/html',
            title: 'Cake design gallery',
          },
          {
            href: `${origin}/customizing`,
            type: 'text/html',
            title: 'Customizable AI-analyzed cake designs',
          },
          {
            href: `${origin}/feed/google`,
            type: 'application/xml',
            title: 'Google Merchant product feed',
          },
        ],
        author: [
          {
            href: `${origin}/about`,
            type: 'text/html',
            title: 'About Genie.ph',
          },
        ],
      },
    ],
  }

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  })
}
