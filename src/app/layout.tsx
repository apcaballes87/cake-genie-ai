import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { ErrorBoundary } from '@/components/ErrorBoundary'

import ClientHashRedirect from '@/components/ClientHashRedirect'
import AnimatedBlobs from '@/components/UI/AnimatedBlobs'
import TawkToChat from '@/components/TawkToChat'
import ErrorLogger from '@/components/ErrorLogger'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://genie.ph'),
  title: {
    default: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
    template: '%s | Genie.ph',
  },
  description: 'Upload any cake design, customize with AI, and get instant pricing from the best cakeshops and homebakers here in Cebu. Order custom cakes online today!',
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
  alternates: {
    canonical: '/',
    languages: {
      'en-PH': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://genie.ph',
    siteName: 'Genie.ph',
    title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
    description: 'Upload any cake design, customize with AI, and get instant pricing from the best cakeshops and homebakers here in Cebu. Order custom cakes online today!',
    images: [
      {
        url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg', // Ensure this is the correct OG image
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
    images: ['https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg'],
  },
  icons: {
    icon: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
    apple: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
  },
}

function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Genie.ph',
    url: 'https://genie.ph',
    logo: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
    description: 'The first AI-powered marketplace for custom cakes in the Philippines. Based in Cebu.',
    sameAs: [
      'https://web.facebook.com/geniephilippines',
      'https://www.instagram.com/genie.ph/',
      'http://tiktok.com/@genie.ph',
      'https://www.youtube.com/@genieph'
    ],
    areaServed: {
      '@type': 'AdministrativeArea',
      name: 'Cebu'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+63-908-940-8747',
      contactType: 'customer service',
      areaServed: 'PH',
      availableLanguage: ['English', 'Filipino']
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100`} suppressHydrationWarning>
        <OrganizationSchema />
        <Providers>
          <ErrorBoundary>
            <ClientHashRedirect />
            <AnimatedBlobs />
            {children}
            <TawkToChat />
            <ErrorLogger />
          </ErrorBoundary>
        </Providers>

        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "te894qldzn");
          `}
        </Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-C28QNPRWFK" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-C28QNPRWFK');
          `}
        </Script>
      </body>
    </html>
  )
}
