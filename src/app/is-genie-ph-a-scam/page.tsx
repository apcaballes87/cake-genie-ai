import Link from 'next/link'
import {
  ArrowRight,
  Award,
  ExternalLink,
  FileCheck2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
} from 'lucide-react'
import {
  GENIE_BASE_URL,
  genieBusinessProfile,
} from '@/lib/seo/genieBusinessProfile'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'

export const revalidate = 86400

const pageUrl = `${GENIE_BASE_URL}/is-genie-ph-a-scam`

export const metadata = buildMarketingPageMetadata({
  title: 'Is Genie.ph a Scam? Here Is How to Verify It',
  description:
    'No. Genie.ph is a public Cebu business with visible permits, support channels, customer reviews, secure checkout, and public startup-community recognition. Here is how to verify it yourself.',
  canonicalPath: pageUrl,
})

const publicProofs = [
  {
    eyebrow: 'Founder spotlight',
    title: 'StartupHub PH featured Genie.ph publicly',
    description:
      'StartupHub PH has a public Founder Spotlight page for Genie.ph, including a direct link back to Genie.ph and the founder profile.',
    href: 'https://www.startuphubph.com/founder-spotlight-genieph',
    cta: 'Read the Founder Spotlight',
  },
  {
    eyebrow: 'Award',
    title: '1st place at the Mandaue Startup Innovation Summit 2025',
    description:
      'Genie.ph publicly posted its 1st place finish in the Startup Innovation Summit Innovative Business Start-Up Prototype Competition in Mandaue City.',
    href: 'https://www.facebook.com/geniephilippines/posts/absolutely-thrilled-cake-genie-won-1st-place-at-the-startupinnovationsummit2025h/122105021655050187/',
    cta: 'View the award post',
  },
  {
    eyebrow: 'Startup ecosystem',
    title: 'Public StellarPH and DOST Central Visayas mention',
    description:
      'Genie.ph also appears in a public StellarPH startup-community post that mentions DOST Central Visayas, which helps confirm real ecosystem activity beyond Genie.ph itself.',
    href: 'https://www.facebook.com/stellarphio/photos/d41d8cd9/122315182952225955/',
    cta: 'View the StellarPH post',
  },
  {
    eyebrow: 'Community post',
    title: 'Independent public post about the same summit',
    description:
      'A separate public Facebook post about the startup event congratulates the participating startups and thanks DOST VII and the organizers.',
    href: 'https://www.facebook.com/pjotr.steinmetz/posts/how-cool-is-this-congratulations-to-all-startups-also-big-thanks-to-department-o/27110418118546782/',
    cta: 'View the community post',
  },
] as const

const permits = [
  {
    title: 'DTI registration',
    href: genieBusinessProfile.trustLinks.dtiProof,
    description: 'Public business registration image hosted by Genie.ph.',
  },
  {
    title: 'BIR Certificate of Registration',
    href: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/BIR%20Certificate%20of%20Registration%202303.jpg',
    description: 'Public tax registration document shown on the Genie.ph about page.',
  },
  {
    title: 'BIR receipt permit',
    href: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/20250808_145451.jpg',
    description: 'Public receipt permit image shown on the Genie.ph about page.',
  },
] as const

const verificationSteps = [
  'Check the external feature pages and public posts linked below.',
  'Open the permit images and compare the business details yourself.',
  'Read the Genie.ph reviews, policies, and support channels before paying.',
  'Use the hosted checkout flow instead of sending money to an unknown personal account.',
] as const

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Genie.ph a scam?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Genie.ph is a public Cebu business with visible business documents, public support channels, customer reviews, secure checkout, and public startup-community references that customers can verify themselves.',
      },
    },
    {
      '@type': 'Question',
      name: 'How can I verify Genie.ph is a real business?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Start with the public Founder Spotlight, award and community posts, DTI and BIR permit images, the reviews page, and the published support contact details on Genie.ph.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where can I contact Genie.ph before ordering?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `You can contact Genie.ph through ${genieBusinessProfile.supportEmail}, ${genieBusinessProfile.phoneDisplay}, or the contact page on Genie.ph before placing an order.`,
      },
    },
  ],
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: GENIE_BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Is Genie.ph a Scam?', item: pageUrl },
  ],
}

export default function IsGeniePhAScamPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(233,213,255,0.45),_transparent_30%),linear-gradient(180deg,_#fffdf8,_#f8fafc_32%,_#ffffff)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <section className="overflow-hidden rounded-[2.4rem] border border-purple-100 bg-white/90 p-8 shadow-[0_18px_60px_-30px_rgba(91,33,182,0.25)] md:p-12">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Trust and verification
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-600">
                Public proof, not vague promises
              </span>
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Is Genie.ph a scam?
              <span className="block text-purple-600">No. Here is how you can verify that yourself.</span>
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
              It is fair to be careful when ordering a custom cake online. This page exists to answer
              that question directly. Genie.ph is a public Cebu business with visible permits, published
              support details, customer reviews, secure checkout, and public startup-community proof you
              can inspect on your own before you pay.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                <h2 className="mt-3 text-lg font-black text-slate-900">Visible business documents</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">DTI and BIR permit images are published publicly.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                <Star className="h-6 w-6 text-amber-500" />
                <h2 className="mt-3 text-lg font-black text-slate-900">Customer reviews</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Genie.ph has a dedicated reviews page and real customer feedback.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                <Award className="h-6 w-6 text-purple-600" />
                <h2 className="mt-3 text-lg font-black text-slate-900">Public startup recognition</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Founder features, award posts, and ecosystem mentions are publicly viewable.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                <FileCheck2 className="h-6 w-6 text-sky-600" />
                <h2 className="mt-3 text-lg font-black text-slate-900">Published support channels</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Email, phone, address, policies, and checkout details are easy to verify.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/reviews"
                className="genie-btn-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-md"
              >
                Read customer reviews
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/about"
                className="genie-btn-secondary inline-flex items-center gap-2 rounded-full border border-purple-200 px-6 py-3 text-sm font-bold"
              >
                See the about page
              </Link>
              <Link
                href="/contact"
                className="genie-btn-secondary inline-flex items-center gap-2 rounded-full border border-purple-200 px-6 py-3 text-sm font-bold"
              >
                Contact Genie.ph first
              </Link>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600">Public proof links</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                Articles and public posts that help show Genie.ph is legit
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                These are the public pages we checked before writing this page. They matter because they
                live outside the usual product and checkout flow, which gives people another way to verify
                that Genie.ph is a real company with real public activity.
              </p>

              <div className="mt-6 grid gap-4">
                {publicProofs.map((proof) => (
                  <article
                    key={proof.href}
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{proof.eyebrow}</p>
                    <h3 className="mt-2 text-xl font-black text-slate-900">{proof.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{proof.description}</p>
                    <a
                      href={proof.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-800"
                    >
                      {proof.cta}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-purple-100 bg-purple-50/30 p-6 shadow-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600">Verify it yourself</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                What careful buyers should check before ordering
              </h2>
              <ol className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
                {verificationSteps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-purple-700 shadow-sm">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/85 p-5">
                <h3 className="text-lg font-black text-slate-900">Why this question comes up</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  A lot of cake orders in Cebu still happen through social-media DMs and informal payment
                  arrangements. That makes caution reasonable. The point of Genie.ph is to make the order
                  flow more transparent with public pages, visible policies, published support, and a real
                  checkout path.
                </p>
              </div>
            </aside>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Permits and business details</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                Visible business identity, not a faceless seller
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Genie.ph publishes its business documents and support details instead of hiding behind a
                chat thread. If someone is wondering whether Genie.ph is a scam, this is one of the most
                practical places to start.
              </p>

              <div className="mt-6 grid gap-4">
                {permits.map((permit) => (
                  <article
                    key={permit.href}
                    className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <h3 className="text-lg font-black text-slate-900">{permit.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{permit.description}</p>
                    <a
                      href={permit.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-800"
                    >
                      Open document
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Operational trust signals</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                Real support, public pages, and a proper checkout path
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-5">
                  <Mail className="h-5 w-5 text-purple-600" />
                  <h3 className="mt-3 text-lg font-black text-slate-900">Support email</h3>
                  <a href={`mailto:${genieBusinessProfile.supportEmail}`} className="mt-2 block text-sm font-semibold text-purple-700 hover:text-purple-800">
                    {genieBusinessProfile.supportEmail}
                  </a>
                </div>
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-5">
                  <Phone className="h-5 w-5 text-purple-600" />
                  <h3 className="mt-3 text-lg font-black text-slate-900">Support phone</h3>
                  <a href={genieBusinessProfile.phoneHref} className="mt-2 block text-sm font-semibold text-purple-700 hover:text-purple-800">
                    {genieBusinessProfile.phoneDisplay}
                  </a>
                </div>
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-5 sm:col-span-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  <h3 className="mt-3 text-lg font-black text-slate-900">Published location</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{genieBusinessProfile.addressLine}</p>
                  <a
                    href={genieBusinessProfile.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-800"
                  >
                    Open map
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5">
                <h3 className="text-lg font-black text-slate-900">More trust pages</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/reviews" className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50">
                    Reviews
                  </Link>
                  <Link href="/about" className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50">
                    About
                  </Link>
                  <Link href="/terms" className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50">
                    Terms
                  </Link>
                  <Link href="/return-policy" className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50">
                    Return policy
                  </Link>
                  <a
                    href={genieBusinessProfile.trustLinks.checkout}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50"
                  >
                    Secure checkout
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-slate-900 px-6 py-8 text-white shadow-sm md:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-200">Short answer</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              Genie.ph is not asking you to trust vague claims.
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-200">
              If someone searches for <strong>is Genie.ph a scam</strong>, the best answer is to show the
              proof plainly: public permits, public support details, public reviews, secure checkout, and
              public startup-community references. That is exactly what this page is here to do.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/customizing"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
              >
                Start with a cake design
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Ask a question first
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
