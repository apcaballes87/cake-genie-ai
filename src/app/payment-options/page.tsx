import Link from 'next/link';
import { AlertCircle, ArrowRight, CreditCard, ShieldCheck } from 'lucide-react';
import {
  PAYMENT_METHOD_GROUPS,
  PUBLIC_ORDER_FACTS,
  SUPPORT_PAGE_PATHS,
} from '@/lib/seo/publicOrderFacts';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

const PAGE_URL = 'https://genie.ph/payment-options';

export const metadata = buildMarketingPageMetadata({
  title: 'Payment Options and Accepted Payment Methods',
  description: PUBLIC_ORDER_FACTS.paymentSummary,
  canonicalPath: PAGE_URL,
});

const PAYMENT_FAQS = [
  {
    question: 'Is it safe to pay online on Genie.ph?',
    answer:
      'Yes. Genie.ph checkout is processed through Xendit, a PCI DSS-compliant payment gateway. Sensitive card details are handled by the payment provider, not stored directly on Genie.ph.',
  },
  {
    question: 'When will I be charged?',
    answer:
      'You are charged once you confirm payment during checkout. Your order is only finalized after the payment step succeeds.',
  },
  {
    question: 'Can I pay cash on delivery?',
    answer:
      'No. Genie.ph currently accepts online and supported partner payment methods only, which helps confirm custom cake orders faster for both customers and bakers.',
  },
] as const;

export default function PaymentOptionsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Secure checkout support page
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            Payment options on Genie.ph
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            {PUBLIC_ORDER_FACTS.paymentSummary}
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            {PUBLIC_ORDER_FACTS.supportSummary}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={SUPPORT_PAGE_PATHS.facts}
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View pricing and ordering facts
            </Link>
            <Link
              href={SUPPORT_PAGE_PATHS.customizingUpload}
              className="genie-btn-primary rounded-full px-6 py-3 text-sm font-bold shadow-md"
            >
              Start an order
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Secure payments via Xendit</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Genie.ph uses Xendit-powered checkout so customers can complete payment through supported wallets, cards, bank options, and partner channels. This keeps order confirmation tied to successful payment instead of informal transfers.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-8">
          {PAYMENT_METHOD_GROUPS.map((group) => (
            <div key={group.title} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`rounded-full px-3 py-2 text-sm font-semibold ${group.accentClassName}`}>
                  {group.title}
                </div>
                <p className="text-sm text-slate-500">{group.description}</p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.methods.map((method) => (
                  <div key={method.name} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={method.logoUrl}
                        alt={method.name}
                        width={48}
                        height={32}
                        className="h-8 w-12 rounded bg-white object-contain"
                      />
                      <h3 className="font-semibold text-slate-900">{method.name}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{method.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">When payment happens</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Payment is collected during checkout. Orders move forward only after the payment step succeeds.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">No cash on delivery</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Genie.ph does not currently support cash on delivery for custom cake orders.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <ArrowRight className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Support fallback</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {PUBLIC_ORDER_FACTS.supportSummary}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Frequently asked questions</h2>
          <div className="mt-6 space-y-6">
            {PAYMENT_FAQS.map((faq) => (
              <div key={faq.question} className="border-b border-slate-100 pb-6 last:border-b-0 last:pb-0">
                <h3 className="text-lg font-semibold text-slate-900">{faq.question}</h3>
                <p className="mt-2 text-base leading-7 text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p>
              Payment method availability can vary by checkout context or provider support. If you hit a payment issue, use the support channels on Genie.ph before retrying multiple times.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
