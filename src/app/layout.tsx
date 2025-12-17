import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

import ClientHashRedirect from '@/components/ClientHashRedirect'
import AnimatedBlobs from '@/components/UI/AnimatedBlobs'
import TawkToChat from '@/components/TawkToChat'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://genie.ph'),
  title: {
    default: 'Genie.ph - AI-Powered Custom Cake Design & Ordering',
    template: '%s | Genie.ph',
  },
  description: 'Design and order custom cakes with AI assistance. Upload any design, customize it, and order from local bakeries.',
  keywords: ['custom cakes', 'cake design', 'AI cake', 'Cebu bakery', 'birthday cake', 'wedding cake'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://genie.ph',
    siteName: 'Genie.ph',
    title: 'Genie.ph - AI-Powered Custom Cake Design',
    description: 'Design and order custom cakes with AI assistance.',
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100`} suppressHydrationWarning>
        <Providers>
          <ClientHashRedirect />
          <AnimatedBlobs />
          {children}
          <TawkToChat />
        </Providers>

      </body>
      <Script id="microsoft-clarity" strategy="afterInteractive">
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
    </html >
  )
}
