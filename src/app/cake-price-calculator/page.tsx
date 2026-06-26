import Link from 'next/link';
import { ArrowRight, CreditCard, MapPin, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { buildFAQPageSchema } from '@/lib/seo/schema';
import {
  PUBLIC_ORDER_FACTS,
  PUBLIC_PRICING_QUESTIONS,
  SUPPORT_PAGE_PATHS,
  buildCanonicalFactsPageDescription,
} from '@/lib/seo/publicOrderFacts';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

const PAGE_URL = 'https://genie.ph/cake-price-calculator';

export const metadata = buildMarketingPageMetadata({
  title: 'Cake Pricing and Ordering Guide',
  description: buildCanonicalFactsPageDescription(),
  canonicalPath: PAGE_URL,
});

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph/' },
    { '@type': 'ListItem', position: 2, name: 'Cake Pricing and Ordering Guide', item: PAGE_URL },
  ],
};

const faqSchema = buildFAQPageSchema(
  PUBLIC_PRICING_QUESTIONS.map((item) => ({ question: item.question, answer: item.answer })),
  PAGE_URL,
);

const factCards = [
  {
    title: 'Starting price',
    value: PUBLIC_ORDER_FACTS.bentoStartingPrice,
    body: 'Bento cakes start here, while larger or more detailed cakes are priced after AI analysis.',
    icon: Sparkles,
  },
  {
    title: 'Delivery coverage',
    value: 'Metro Cebu',
    body: 'City-based delivery fees and service areas are published before checkout.',
    icon: Truck,
  },
  {
    title: 'Payments',
    value: 'Xendit checkout',
    body: 'GCash, Maya, cards, bank-supported options, and more.',
    icon: CreditCard,
  },
] as const;

const relatedLinks = [
  { href: SUPPORT_PAGE_PATHS.deliveryRates, label: 'Delivery rates' },
  { href: SUPPORT_PAGE_PATHS.paymentOptions, label: 'Payment options' },
  { href: SUPPORT_PAGE_PATHS.howToOrder, label: 'How to order' },
  { href: SUPPORT_PAGE_PATHS.reviews, label: 'Customer reviews' },
  { href: SUPPORT_PAGE_PATHS.trust, label: 'Trust and verification' },
] as const;

export default function CakePriceCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <Sparkles className="h-4 w-4" />
              Official Genie.ph pricing and ordering facts
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Cake pricing, delivery, and checkout details in one place
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              The real AI upload flow starts on Genie.ph&apos;s landing page and <Link href={SUPPORT_PAGE_PATHS.customizing} className="font-semibold text-purple-700 hover:text-purple-800">customizing page</Link>. This page is the crawlable support guide for pricing, delivery, payment, and ordering facts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={SUPPORT_PAGE_PATHS.customizingUpload}
                className="genie-btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-md"
              >
                Start with an upload
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={SUPPORT_PAGE_PATHS.howToOrder}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                See the 3-step order flow
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {factCards.map(({ title, value, body, icon: Icon }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Pricing facts</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">{PUBLIC_ORDER_FACTS.pricingSummary}</p>
              <p className="mt-4 text-base leading-7 text-slate-600">{PUBLIC_ORDER_FACTS.pricingProcessSummary}</p>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Delivery coverage</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{PUBLIC_ORDER_FACTS.deliverySummary}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Payment methods</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{PUBLIC_ORDER_FACTS.paymentSummary}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Lead time and support</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{PUBLIC_ORDER_FACTS.leadTimeSummary}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{PUBLIC_ORDER_FACTS.supportSummary}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Useful support pages</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">{PUBLIC_ORDER_FACTS.trustSummary}</p>
              <div className="mt-6 space-y-3">
                {relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-purple-300 hover:text-purple-700"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Frequently asked questions</h2>
            <div className="mt-6 space-y-6">
              {PUBLIC_PRICING_QUESTIONS.map((item) => (
                <div key={item.question} className="border-b border-slate-100 pb-6 last:border-b-0 last:pb-0">
                  <h3 className="text-lg font-semibold text-slate-900">{item.question}</h3>
                  <p className="mt-2 text-base leading-7 text-slate-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
