import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Clock3, MapPin, ShieldCheck, Sparkles, Star, Truck, Upload, ArrowRight, Cake } from 'lucide-react';
import { COMMON_ASSETS } from '@/constants';
import { createClient } from '@/lib/supabase/server';
import { normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews';
import { getRelatedProductsByKeywords, getRecommendedProducts } from '@/services/supabaseService';
import type { CakeGenieReview } from '@/lib/database.types';
import { LandingFooter } from '@/components/landing/LandingFooter';
import SameDayCutoffBanner from '@/components/SameDayCutoffBanner';
import { ReviewCard } from '@/components/ReviewsDisplay';
import { ProductCard } from '@/components/ProductCard';
import type { LandingPageConfig } from './cebuLandingData';

const ROOT_PAGE_EYEBROW = 'Best Online Cake Delivery for Rush Orders in Cebu';
const ROOT_PAGE_HERO_IMAGE =
  'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/CUSTOM-CAKES-FOR-RUSH-ORDERS.WEBP';

type ProductPreview = {
  p_hash: string;
  slug: string | null;
  original_image_url: string;
  price?: number | null;
  keywords?: string | null;
  availability?: string | null;
  image_width?: number | null;
  image_height?: number | null;
};

async function getPageProducts(query: string): Promise<ProductPreview[]> {
  const related = await getRelatedProductsByKeywords(query, null, 8, 0);
  if (related.data && related.data.length >= 4) {
    return related.data;
  }

  const recommended = await getRecommendedProducts(8, 0, { keyword: query });
  return recommended.data || related.data || [];
}

async function getReviewData(): Promise<{ reviews: CakeGenieReview[]; totalReviews: number }> {
  const supabase = await createClient();

  const [reviewResponse, countResponse] = await Promise.all([
    supabase
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT)
      .eq('is_visible', true)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('cakegenie_reviews')
      .select('review_id', { count: 'exact', head: true })
      .eq('is_visible', true)
      .eq('is_approved', true),
  ]);

  return {
    reviews: normalizePublicReviews(reviewResponse.data),
    totalReviews: countResponse.count ?? reviewResponse.data?.length ?? 0,
  };
}



function HeroSampleTile({ product }: { product: ProductPreview }) {
  const href = product.slug ? `/customizing/${product.slug}` : '/customizing';
  const title = product.keywords?.split(',')[0]?.trim() || 'Custom cake sample';

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/85 shadow-[0_18px_44px_-34px_rgba(88,28,135,0.72)] transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={product.original_image_url}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">
          {product.availability === 'rush'
            ? 'Rush'
            : product.availability === 'same-day'
              ? 'Same Day'
              : 'Pre-order'}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{title}</p>
          {product.price ? (
            <p className="mt-1 text-xs font-medium text-white/85">Starts at P{Math.round(product.price)}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-slate-900">
        <span>{question}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="pt-3 text-sm leading-6 text-slate-600">{answer}</p>
    </details>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-slate-600">{body}</p>
    </div>
  );
}

export async function LocalSeoLandingPage({ config }: { config: LandingPageConfig }) {
  const [products, reviewData] = await Promise.all([
    getPageProducts(config.sampleQuery),
    getReviewData(),
  ]);

  const heroProducts = products.slice(0, 4);
  const galleryProducts = products.slice(0, 8);
  const sampleCount = Math.max(galleryProducts.length, 4);
  const pageUrl = `https://genie.ph/${config.slug}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: config.metadataTitle,
      description: config.metaDescription,
      url: pageUrl,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Genie.ph',
        url: 'https://genie.ph',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: config.h1,
      provider: {
        '@type': 'Organization',
        name: 'Genie.ph',
        url: 'https://genie.ph',
      },
      areaServed: config.coverageAreas.map((area) => ({
        '@type': 'City',
        name: area,
      })),
      offers: config.pricingCards.map((card) => ({
        '@type': 'Offer',
        name: card.label,
        description: `${card.price}. ${card.detail}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
        { '@type': 'ListItem', position: 2, name: config.h1, item: pageUrl },
      ],
    },
  ];

  return (
    <>
      {jsonLd.map((schema, index) => (
        <script
          key={`local-seo-jsonld-${config.slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}

      <div className="min-h-screen pb-32 md:pb-16">
        <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3">
                <Image src={COMMON_ASSETS.logo} alt="Genie.ph" width={164} height={40} className="h-10 w-auto object-contain" />
              </Link>
              <nav className="hidden items-center gap-5 lg:flex">
                <Link href="/collections" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                  Browse Cakes
                </Link>
                <Link href="/shop" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                  Our Bakers
                </Link>
                <Link href="/blog" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                  Blog
                </Link>
                <Link href="/compare" className="text-sm font-medium text-gray-700 hover:text-purple-700 transition-colors whitespace-nowrap">
                  Compare
                </Link>
              </nav>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href={config.secondaryCta.href}
                className="rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-700 transition-colors hover:border-purple-300 hover:bg-purple-50"
              >
                Browse samples
              </Link>
              <Link
                href={config.primaryCta.href}
                className="rounded-full bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
              >
                Customize now
              </Link>
            </div>
            <Link
              href={config.primaryCta.href}
              className="rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white md:hidden"
            >
              Order now
            </Link>
          </div>
        </header>

        <main>
          <section className="mx-auto max-w-7xl px-4 pb-6 pt-6 sm:px-6 lg:px-8 lg:pb-10">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_24px_60px_-40px_rgba(88,28,135,0.55)] backdrop-blur">
              <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:p-10">
                <div>
                  <h1 className="sr-only">{config.h1}</h1>
                  <div className="mb-4 inline-flex items-center rounded-full bg-linear-to-r from-pink-500 to-purple-600 px-4 py-2 shadow-sm">
                    <SameDayCutoffBanner />
                  </div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">{ROOT_PAGE_EYEBROW}</p>
                  <div className="max-w-3xl">
                    <div className="relative mb-5 overflow-hidden rounded-[1.75rem] md:hidden">
                      <div className="relative h-[38vw] min-h-[170px] max-h-[214px]">
                        <Image
                          src={ROOT_PAGE_HERO_IMAGE}
                          alt="Custom cakes for spontaneous celebrations"
                          fill
                          priority
                          sizes="100vw"
                          className="object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-white/60" />
                        <div className="absolute inset-0 flex items-center justify-center px-4 pb-6 pt-4 text-center">
                          <h2 className="w-full text-[54px] font-extrabold leading-none tracking-tight text-gray-900 max-[520px]:text-[47px] max-[414px]:text-[40px]">
                            <span className="block whitespace-nowrap text-center">Custom Cakes</span>
                            <span className="block whitespace-nowrap text-purple-600 italic">For Spontaneous</span>
                            <span className="block whitespace-nowrap text-purple-600 italic">Celebrations</span>
                          </h2>
                        </div>
                      </div>
                    </div>

                    <h2 className="hidden text-[2.95rem] font-extrabold leading-[1.05] tracking-tight text-gray-900 md:block min-[945px]:text-5xl min-[1232px]:text-6xl">
                      <span className="block whitespace-nowrap text-center md:text-left">Custom Cakes</span>
                      <span className="block whitespace-nowrap text-purple-600 italic md:text-left">For Spontaneous</span>
                      <span className="block whitespace-nowrap text-purple-600 italic md:text-left">Celebrations</span>
                    </h2>
                  </div>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {config.heroEyebrow}
                  </p>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                    {config.heroBody}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {config.heroHighlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="rounded-2xl border border-purple-100 bg-purple-50/80 px-4 py-3 text-sm font-medium leading-6 text-slate-700"
                      >
                        {highlight}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={config.primaryCta.href}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
                    >
                      {config.primaryCta.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={config.secondaryCta.href}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-200 bg-white px-6 py-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
                    >
                      {config.secondaryCta.label}
                    </Link>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {reviewData.totalReviews > 0 ? `${reviewData.totalReviews}+` : 'Verified'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">Verified review proof</p>
                      <p className="mt-1 text-sm text-slate-500">Real customer feedback already shown on the Genie.ph site.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-2xl font-extrabold text-slate-900">Metro Cebu</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">Completed order signal</p>
                      <p className="mt-1 text-sm text-slate-500">{config.completedOrdersProof}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-2xl font-extrabold text-slate-900">{sampleCount}+</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">Real sample designs</p>
                      <p className="mt-1 text-sm text-slate-500">Visual proof from Genie.ph cake listings buyers can actually click through.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 self-start">
                  {heroProducts.map((product) => (
                    <HeroSampleTile key={product.p_hash} product={product} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Social proof"
              title="Buyer trust signals that help this page convert"
              body="Genie.ph already uses reviews heavily on the homepage because buyers need proof. These Cebu landing pages keep that same conversion logic instead of dropping visitors into thin SEO copy."
            />
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {reviewData.reviews.map((review) => (
                <ReviewCard key={review.review_id} review={review} />
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Sample designs"
              title={config.galleryTitle}
              body={config.galleryIntro}
            />
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {galleryProducts.map((product) => (
                <ProductCard key={product.p_hash} {...product} />
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Coverage and timing"
              title="Local delivery promise, speed, and cutoff guidance"
              body={config.coverageIntro}
            />
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
                  <MapPin className="h-4 w-4" />
                  Coverage areas
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.coverageAreas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                    >
                      {area}
                    </span>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-pink-100 bg-pink-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">Best same-day chance: checkout before 4PM</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    More elaborate decorations, theme work, and toppers usually need more lead time than cleaner rush-friendly layouts.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {config.deliveryCards.map((card) => (
                  <article key={card.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
                      <Truck className="h-4 w-4" />
                      {card.badge}
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-900">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Pricing guide"
              title="Clear starting-price guidance before buyers click through"
              body={config.pricingNote}
            />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {config.pricingCards.map((card) => (
                <article key={card.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{card.price}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="How ordering works"
              title="Three simple steps from sample design to checkout"
              body="These pages are meant to reduce hesitation. Buyers should understand the path immediately, especially on mobile."
            />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {config.steps.map((step, index) => (
                <article key={step.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-sm md:p-8">
                <SectionHeading
                  eyebrow="Why Genie"
                  title="Why these pages still feel like the current Genie.ph site"
                  body="The layout, spacing, proof treatment, and CTAs stay close to the homepage so these new localized pages feel like natural extensions of the brand."
                />
                <div className="mt-6 grid gap-4">
                  {config.whyGenie.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="rounded-[2rem] border border-white/70 bg-linear-to-br from-purple-600 to-pink-500 p-6 text-white shadow-sm md:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Strong CTA path</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight">One primary action. One secondary browse option.</h2>
                <p className="mt-4 text-sm leading-6 text-white/85">
                  Every section keeps buyers oriented toward either the customizing flow or a highly relevant discovery page. That is exactly how the homepage converts.
                </p>
                <div className="mt-6 grid gap-3">
                  <Link
                    href={config.primaryCta.href}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
                  >
                    <Upload className="h-4 w-4" />
                    {config.primaryCta.label}
                  </Link>
                  <Link
                    href={config.secondaryCta.href}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                  >
                    <Cake className="h-4 w-4" />
                    {config.secondaryCta.label}
                  </Link>
                </div>
              </aside>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="FAQ"
              title="Helpful answers for Cebu buyers close to checkout"
              body="These FAQs are written for commercial-intent objections rather than generic bakery trivia."
            />
            <div className="mt-6 grid gap-4">
              {config.faqs.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <SectionHeading
                eyebrow="Internal links"
                title="Keep exploring related Cebu cake pages"
                body="These links help buyers branch into a better-fit page without leaving the Genie.ph conversion path."
              />
              <div className="mt-6 flex flex-wrap gap-3">
                {config.relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-linear-to-r from-slate-900 via-purple-900 to-pink-700 p-6 text-white shadow-[0_24px_60px_-40px_rgba(88,28,135,0.72)] md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Final CTA</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">{config.finalCtaTitle}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">{config.finalCtaBody}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={config.primaryCta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {config.primaryCta.label}
                </Link>
                <Link
                  href={config.secondaryCta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <Clock3 className="h-4 w-4" />
                  {config.secondaryCta.label}
                </Link>
              </div>
            </div>
          </section>
        </main>

        <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
          <div className="rounded-[1.5rem] border border-white/80 bg-white/92 p-3 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={config.primaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white"
              >
                <Upload className="h-4 w-4" />
                Order now
              </Link>
              <Link
                href={config.secondaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-200 bg-white px-4 py-3 text-center text-sm font-semibold text-purple-700"
              >
                <Truck className="h-4 w-4" />
                See samples
              </Link>
            </div>
          </div>
        </div>

        <LandingFooter />
      </div>
    </>
  );
}
