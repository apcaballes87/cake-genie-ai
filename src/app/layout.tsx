import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { ErrorBoundary } from '@/components/ErrorBoundary'

import ClientHashRedirect from '@/components/ClientHashRedirect'
import AnimatedBlobs from '@/components/UI/AnimatedBlobs'
import FloatingChatBubble from '@/components/FloatingChatBubble'
import ErrorLogger from '@/components/ErrorLogger'

const inter = Inter({ subsets: ['latin'], display: 'optional' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://genie.ph'),
  title: {
    default: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
    template: '%s | Genie.ph',
  },
  description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!',
  keywords: ['custom cakes', 'cake design', 'AI cake', 'Cebu bakery', 'birthday cake', 'wedding cake', 'online marketplace', 'cake delivery Philippines'],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Genie.ph',
    title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
    description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!',
    images: [
      {
        url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/customized-cakes-cover-photo-genieph.webp', // Ensure this is the correct OG image
        width: 1200,
        height: 630,
        alt: 'Genie.ph - Custom Cakes Online',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Genie.ph | Online Marketplace for Custom Cakes',
    description: 'Upload design, get pricing, order custom cakes online.',
    images: [
      {
        url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/customized-cakes-cover-photo-genieph.webp',
        width: 1200,
        height: 630,
        alt: 'Genie.ph | Online Marketplace for Custom Cakes',
      },
    ],
  },
  icons: {
    icon: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
    apple: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
  },
  other: {
    'p:domain_verify': '0a26251bc18b086ea69d8022ef9eeb05',
  },
}

function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    '@id': 'https://genie.ph/#organization',
    name: 'Genie.ph',
    url: 'https://genie.ph',
    logo: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
    image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/customized-cakes-cover-photo-genieph.webp',
    description: 'The first AI-powered marketplace for custom cakes in the Philippines. Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu.',
    telephone: '+63-908-940-8747',
    email: 'hello@genie.ph',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Park Tower One, Cebu Business Park',
      addressLocality: 'Cebu City',
      addressRegion: 'Cebu',
      postalCode: '6000',
      addressCountry: 'PH'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 10.3175,
      longitude: 123.9046
    },
    sameAs: [
      'https://web.facebook.com/geniephilippines',
      'https://www.instagram.com/genie.ph/',
      'https://www.tiktok.com/@genie.ph',
      'https://www.youtube.com/@genieph'
    ],
    areaServed: {
      '@type': 'State',
      name: ['Cebu', 'Metro Manila', 'Philippines']
    },
    serviceType: 'Online Marketplace for Custom Cakes',
    provider: {
      '@type': 'Organization',
      name: 'Genie.ph',
      url: 'https://genie.ph'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+63-908-940-8747',
      contactType: 'customer service',
      areaServed: 'PH',
      availableLanguage: ['English', 'Filipino']
    },
    openingHours: 'Mo-Fr 09:00-18:00, Sa 09:00-15:00',
    priceRange: '₱₱',
    servesCuisine: 'Custom Cakes',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Custom Cake Services',
      itemListElement: [
        { '@type': 'Offer', name: 'Custom Cake Design' },
        { '@type': 'Offer', name: 'Birthday Cakes' },
        { '@type': 'Offer', name: 'Wedding Cakes' },
        { '@type': 'Offer', name: 'Special Occasion Cakes' }
      ]
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Genie.ph',
            url: 'https://genie.ph',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://genie.ph/search?q={search_term_string}'
              },
              'query-input': 'required name=search_term_string'
            }
          })
        }}
      />
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const shouldLoadAnalytics = process.env.NODE_ENV === 'production'

  return (
    <html lang="en-PH" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen genie-page-bg`} suppressHydrationWarning>
        <OrganizationSchema />
        <Providers>
          <ErrorBoundary>
            <ClientHashRedirect />
            <AnimatedBlobs />
            {children}
            <FloatingChatBubble />
            <ErrorLogger />
          </ErrorBoundary>
        </Providers>

        <Script id="microsoft-clarity" strategy="beforeInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "te894qldzn");
          `}
        </Script>
        {shouldLoadAnalytics && (
          <>
            <Script src="https://www.googletagmanager.com/gtag/js?id=G-C28QNPRWFK" strategy="lazyOnload" />
            <Script id="google-analytics" strategy="lazyOnload">
              {`
                window.dataLayer = window.dataLayer || [];
                window.gtag = function gtag(){window.dataLayer.push(arguments);}
                window.gtag('js', new Date());

                window.gtag('config', 'G-C28QNPRWFK');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
