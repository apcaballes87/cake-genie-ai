import Link from 'next/link';
import { CheckCircle2, CreditCard, Sparkles, Truck } from 'lucide-react';
import {
  PUBLIC_ORDER_FACTS,
  SUPPORT_PAGE_PATHS,
} from '@/lib/seo/publicOrderFacts';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

const PAGE_URL = 'https://genie.ph/how-to-order';

export const metadata = buildMarketingPageMetadata({
  title: 'How to Order Custom Cakes Online in Cebu',
  description:
    'Learn the Genie.ph order flow: upload a design, customize it, review pricing, and complete secure checkout for Metro Cebu cake delivery or pickup.',
  canonicalPath: PAGE_URL,
});

const ORDER_STEPS = [
  {
    title: '1. Upload a design',
    body: 'Start on the Genie.ph landing page or customizing page. Upload a reference image or choose a design you want to customize.',
  },
  {
    title: '2. Review and customize',
    body: 'Genie.ph analyzes the design, shows a starting price, and lets you adjust cake size, flavor, icing, toppers, and messages before adding to cart.',
  },
  {
    title: '3. Checkout with delivery or pickup details',
    body: 'Set your date, time, and fulfillment details, then complete secure online checkout using the supported payment methods.',
  },
] as const;

const SUPPORT_BLOCKS = [
  {
    title: 'What affects price',
    body: PUBLIC_ORDER_FACTS.pricingSummary,
    icon: Sparkles,
  },
  {
    title: 'Delivery and pickup',
    body: PUBLIC_ORDER_FACTS.deliverySummary,
    icon: Truck,
  },
  {
    title: 'Payment and support',
    body: `${PUBLIC_ORDER_FACTS.paymentSummary} ${PUBLIC_ORDER_FACTS.supportSummary}`,
    icon: CreditCard,
  },
] as const;

export default function HowToOrderPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            How to order a custom cake on Genie.ph
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Genie.ph keeps the order flow simple: upload a design, review the AI-priced starting point, customize the details, and finish checkout with delivery or pickup information.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={SUPPORT_PAGE_PATHS.customizingUpload}
              className="genie-btn-primary rounded-full px-6 py-3 text-sm font-bold shadow-md"
            >
              Start with an upload
            </Link>
            <Link
              href={SUPPORT_PAGE_PATHS.facts}
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View pricing and ordering facts
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">The 3-step flow</h2>
          <div className="mt-6 space-y-5">
            {ORDER_STEPS.map((step) => (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-base leading-7 text-slate-600">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {SUPPORT_BLOCKS.map(({ title, body, icon: Icon }) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Need help before ordering?</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">{PUBLIC_ORDER_FACTS.leadTimeSummary}</p>
          <p className="mt-3 text-base leading-7 text-slate-600">{PUBLIC_ORDER_FACTS.supportSummary}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={SUPPORT_PAGE_PATHS.contact}
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Contact support
            </Link>
            <Link
              href={SUPPORT_PAGE_PATHS.paymentOptions}
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Review payment options
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
