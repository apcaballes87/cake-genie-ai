import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Providers } from '@/components/Providers'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AnalyticsBoundary } from '@/components/AnalyticsBoundary'
import { WebVitalsReporter } from '@/components/WebVitalsReporter'

import ClientHashRedirect from '@/components/ClientHashRedirect'
import FloatingChatBubble from '@/components/FloatingChatBubble'
import ErrorLogger from '@/components/ErrorLogger'
import {
  buildGenieOrganizationSchema,
  buildGenieWebsiteSchema,
  genieBusinessProfile,
} from '@/lib/seo/genieBusinessProfile'
import { CLARITY_PROJECT_ID, GA4_MEASUREMENT_ID } from '@/lib/analyticsRoutes'

const inter = Inter({ subsets: ['latin'], display: 'optional' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://genie.ph/'),
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
        url: genieBusinessProfile.ogImageUrl,
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
        url: genieBusinessProfile.ogImageUrl,
        width: 1200,
        height: 630,
        alt: 'Genie.ph | Online Marketplace for Custom Cakes',
      },
    ],
  },
  other: {
    'p:domain_verify': '0a26251bc18b086ea69d8022ef9eeb05',
  },
}

function OrganizationSchema() {
  const organizationSchema = buildGenieOrganizationSchema()
  const websiteSchema = buildGenieWebsiteSchema()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const shouldLoadAnalytics = process.env.NODE_ENV === 'production'

  return (
    <html lang="en-PH" suppressHydrationWarning>
      <head>
        {/*
          Preconnect to the Supabase storage CDN. Almost every image on the
          site loads from this host, including the homepage hero LCP image.
          Setting up DNS + TLS in advance saves ~50-150ms on the first image
          request (especially on cold cellular connections).

          We do NOT preconnect to Google Tag Manager or Clarity. These scripts
          are intentionally kept off the critical rendering path.
        */}
        <link
          rel="preconnect"
          href="https://cqmhanqnfybyxezhobkx.supabase.co"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${inter.className} min-h-screen genie-page-bg`} suppressHydrationWarning>
        <OrganizationSchema />
        <Providers>
          <ErrorBoundary>
            {shouldLoadAnalytics && (
              <Suspense fallback={null}>
                <AnalyticsBoundary
                  enabled={shouldLoadAnalytics}
                  measurementId={GA4_MEASUREMENT_ID}
                />
                <WebVitalsReporter />
              </Suspense>
            )}
            <ClientHashRedirect />
            {children}
            <FloatingChatBubble />
            <ErrorLogger />
          </ErrorBoundary>
        </Providers>

        {shouldLoadAnalytics && (
          <>
            <Script id="microsoft-clarity-bootstrap" strategy="beforeInteractive">
              {`
                window.clarity = window.clarity || function clarity(){(window.clarity.q = window.clarity.q || []).push(arguments);}
              `}
            </Script>
            <Script
              src={`https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`}
              strategy="lazyOnload"
            />
            <Script id="google-analytics-bootstrap" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                window.gtag = function gtag(){window.dataLayer.push(arguments);}
                window.gtag('js', new Date());
              `}
            </Script>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
              strategy="lazyOnload"
            />
          </>
        )}
      </body>
    </html>
  )
}
