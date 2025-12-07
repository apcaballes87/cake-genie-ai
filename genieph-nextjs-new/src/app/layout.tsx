import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

import ClientHashRedirect from '@/components/ClientHashRedirect'
import AnimatedBlobs from '@/components/UI/AnimatedBlobs'

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
        </Providers>
      </body>
    </html>
  )
}
