import Link from 'next/link';
import { ChevronDown, Clock3, MapPin, ShieldCheck, Sparkles, Star, Truck, Upload, ArrowRight, Cake, Shield, HelpCircle, Gift } from 'lucide-react';

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-purple-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-slate-900">
        <span>{question}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="pt-3 text-sm leading-6 text-slate-600">{answer}</p>
    </details>
  );
}

export function KidsIntroContent() {
  const categories = [
    { label: 'Dinosaur Cakes', href: '/search?q=dinosaur%20cake' },
    { label: 'Princess Cakes', href: '/search?q=princess%20cake' },
    { label: 'Superhero Cakes', href: '/search?q=superhero%20cake' },
    { label: 'Cocomelon Cakes', href: '/search?q=cocomelon%20cake' },
    { label: 'Cartoon Cakes', href: '/search?q=character%20cake' },
    { label: 'Toy Story Cakes', href: '/search?q=toy%20story%20cake' },
  ];

  const pricingCards = [
    {
      label: 'Simple themed birthday cakes',
      price: 'From P799',
      detail: 'A good starting point for cleaner color-themed or message-led kids cakes.',
    },
    {
      label: 'Character & topper-led designs',
      price: 'From P1,499',
      detail: 'Best for stronger party themes, licensed-character inspiration, and more decorative setups.',
    },
    {
      label: 'Larger party centerpiece cakes',
      price: 'From P2,199',
      detail: 'Ideal when the cake needs to visually anchor the whole birthday table or serve more guests.',
    },
  ];

  const steps = [
    {
      title: 'Choose the party theme',
      body: 'Start with the color palette, character peg, or party concept so the design direction is obvious from the first click.',
    },
    {
      title: 'Refine the cake details',
      body: 'Adjust the message, topper direction, and size based on the number of guests and the style of party you are planning.',
    },
    {
      title: 'Order early for party week',
      body: 'Once the design looks right, send it through the Genie.ph flow so the baker has a clean production brief.',
    },
  ];

  const whyGenie = [
    {
      title: 'Better inspiration for parents',
      body: 'Parents can browse real themed cake directions instead of trying to explain the whole concept in chat from the beginning.',
    },
    {
      title: 'Built for conversion, not fluff',
      body: 'The page stays useful and practical so party-planning traffic can make a decision instead of bouncing back to search.',
    },
    {
      title: 'Strong internal paths',
      body: 'Every related link keeps buyers moving toward sample discovery, customization, or another relevant Cebu landing page.',
    },
  ];

  const faqs = [
    {
      question: 'What kinds of kids party cake themes can I order in Cebu?',
      answer:
        'Parents commonly order princess, dinosaur, cartoon, gaming, sports, and school-themed cakes, plus color-coordinated party cakes with matching toppers.',
    },
    {
      question: 'How early should I order a themed kids cake?',
      answer:
        'Earlier is always better for more detailed themes. Simpler party cakes are easier to fulfill fast, but character-heavy cakes usually need more lead time.',
    },
    {
      question: 'Can I send a peg from Pinterest or Facebook?',
      answer:
        'Yes. Upload the peg, then use the Genie.ph customization flow to make the design more practical for your budget and timeline.',
    },
    {
      question: 'Do you deliver kids birthday cakes outside Cebu City?',
      answer:
        'Yes. Genie.ph supports Metro Cebu delivery coverage, including Cebu City, Mandaue, Lapu-Lapu, Talisay, and nearby areas depending on the baker.',
    },
  ];

  const relatedLinks = [
    { label: 'Birthday Cake Delivery Cebu City', href: '/birthday-cake-delivery-cebu-city' },
    { label: 'Cake Delivery Cebu', href: '/cake-delivery-cebu' },
    { label: 'Bento Cake Cebu Delivery', href: '/bento-cake-cebu' },
    { label: 'Customize any cake theme', href: '/customizing' },
  ];

  const coverageAreas = ['Cebu City', 'Mandaue', 'Lapu-Lapu', 'Talisay', 'Consolacion', 'Liloan'];

  return (
    <div className="w-full space-y-16">
      {/* 1. Introduction Section */}
      <section className="py-4 md:py-6">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Planning a Kids Birthday Party in Cebu?
          </h2>
          <div className="prose prose-base mx-auto space-y-4 text-slate-600 md:prose-lg md:space-y-6">
            <p>
              Ordering the perfect themed cake should be the easiest part of party planning. Genie.ph
              helps parents and birthday organizers across Metro Cebu bypass the endless DM threads. 
              Upload any reference peg, customize it in real-time, and get instant pricing from trusted local bakers.
            </p>
            <p>
              Whether you want a classic dinosaur land, a princess castle, or a colorful Cocomelon design, 
              we make sure your cake is a stunning, delicious centerpiece that arrives on time for your child&apos;s special day.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.label}
                  href={cat.href}
                  className="rounded-full bg-purple-50 border border-purple-100 hover:bg-purple-100 hover:border-purple-200 px-5 py-2.5 text-sm font-semibold text-purple-700 transition"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. How Ordering Works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">How It Works</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Three Simple Steps to Checkout</h2>
          <p className="mt-3 text-base text-slate-600">These pages are designed to save you time. Keep the process simple and stress-free.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Pricing Guide */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">Pricing Guide</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Clear Starting Price Expectations</h2>
          <p className="mt-3 text-base text-slate-600">Know exactly what to expect before you customize. No hidden inquiries or price-on-request gatekeeping.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {pricingCards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{card.price}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.detail}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Character work, specialty toppers, and custom 3D sculpted details usually require more lead time. Earlier ordering ensures the best rates and availability for kids&apos; party cakes.
        </p>
      </section>

      {/* 4. Coverage and Timing */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">Logistics & Delivery</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Local Delivery Promise & Cebu Coverage</h2>
          <p className="mt-3 text-base text-slate-600">Weekend-friendly drop-offs and family party coordination throughout Cebu.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
              <MapPin className="h-4 w-4" />
              Coverage Areas
            </div>
            <div className="flex flex-wrap gap-2">
              {coverageAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {area}
                </span>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-pink-100 bg-pink-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Weekend-Friendly Delivery Slots</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Most kids birthday parties take place on Saturdays and Sundays. We coordinate delivery with our Cebu bakers to arrive at your venue, restaurant, or home on schedule.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
                <Truck className="h-4 w-4" />
                Delivery Support
              </div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900">Vetted Cake Transports</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Custom party cakes are fragile. We work with Cebu bakers who use dedicated vehicle dispatch to ensure themed decorations stay completely intact.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
                <Clock3 className="h-4 w-4" />
                Cutoff Times
              </div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900">Before 4PM Cutoff</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Simple kids birthday cakes can be ordered for next-day delivery. Elaborate fondant character pegs require a minimum 3 to 5-day lead time.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* 5. Why Genie & Aside CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">Why Genie.ph</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Better Inspiration for Cebu Parents</h2>
            <p className="mt-3 text-base text-slate-600">The layout and interactive experience let you bring any party concept to life.</p>
            
            <div className="mt-6 grid gap-4">
              {whyGenie.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-md font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl bg-linear-to-br from-purple-600 to-pink-500 p-6 text-white shadow-md md:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Planning A Theme?</p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">One Primary Action. Less DM Hassles.</h2>
              <p className="mt-4 text-sm leading-6 text-white/85">
                Every section coordinates parents directly into the customizing flow. Simply upload your child&apos;s favorite theme and see the pricing instantly.
              </p>
            </div>
            <div className="mt-6 grid gap-3">
              <Link
                href="/customizing"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
              >
                <Upload className="h-4 w-4" />
                Customize a Theme Cake
              </Link>
              <Link
                href="/collections"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                <Cake className="h-4 w-4" />
                Browse Designs
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">Frequently Asked Questions</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Kids Party Cake FAQ</h2>
          <p className="mt-3 text-base text-slate-600">Helpful answers for parents ordering custom themed cakes in Cebu.</p>
        </div>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </section>

      {/* 7. Related Cebu Pages */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Related Cebu Cake Delivery Pages</h3>
          <div className="flex flex-wrap gap-2.5">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
