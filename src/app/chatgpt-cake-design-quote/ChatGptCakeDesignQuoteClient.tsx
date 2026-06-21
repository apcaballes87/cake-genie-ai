'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Droplets,
  Layers2,
  Loader2,
  MapPin,
  MessageSquare,
  Palette,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ImageUploader } from '@/components/ImageUploader';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { COMMON_ASSETS } from '@/constants';
import { getSupabaseClient } from '@/lib/supabase/client';
import { clearIndexedDB } from '@/lib/utils/storage';
import { showError, showLoading } from '@/lib/utils/toast';
import {
  CHATGPT_CAKE_DESIGN_QUOTE_FAQS,
  CHATGPT_CAKE_DESIGN_QUOTE_H1,
} from './content';

const flowSteps = [
  {
    title: 'Save your ChatGPT cake image',
    body: 'Download the image from ChatGPT or take a clean screenshot so the cake details are visible.',
    icon: Upload,
  },
  {
    title: 'Upload it to Genie.ph',
    body: 'Start from this page and send the AI-generated design into the same custom cake flow Genie.ph already uses.',
    icon: Upload,
  },
  {
    title: 'Let Genie analyze the design',
    body: 'The system reads the structure, decorations, icing, toppers, colors, and overall complexity to build an initial quote.',
    icon: ScanSearch,
  },
  {
    title: 'Adjust the real order details',
    body: 'Change the cake size, flavor, greeting message, and delivery date so the order matches the celebration you are planning.',
    icon: Palette,
  },
  {
    title: 'Review the price before ordering',
    body: 'You see pricing before checkout, which helps answer whether the AI concept is practical for your Cebu order.',
    icon: BadgeDollarSign,
  },
] as const;

const analysisPoints = [
  {
    title: 'Structure',
    body: 'Detects tier count, cake shape, and overall build so the quote starts from the right base.',
    icon: Layers2,
  },
  {
    title: 'Decorations',
    body: 'Looks at floral work, sprinkles, accents, character elements, and decorative finishes.',
    icon: Sparkles,
  },
  {
    title: 'Icing',
    body: 'Reads icing style, borders, drips, and similar finishing details that affect labor and price.',
    icon: Droplets,
  },
  {
    title: 'Toppers',
    body: 'Identifies topper-heavy concepts, which often change both cost and production difficulty.',
    icon: Sparkles,
  },
  {
    title: 'Colors',
    body: 'Captures the visible palette so you can keep or adjust the ChatGPT-inspired look.',
    icon: Palette,
  },
  {
    title: 'Complexity',
    body: 'Estimates how intricate the design is so you get a realistic starting quote before checkout.',
    icon: BadgeDollarSign,
  },
] as const;

const customizationPoints = [
  {
    title: 'Size and servings',
    body: 'Move from a smaller cake to a larger celebration size while keeping the design direction in place.',
    icon: Layers2,
  },
  {
    title: 'Flavor choices',
    body: 'Switch the practical cake flavor after upload instead of relying only on the image concept.',
    icon: Palette,
  },
  {
    title: 'Message on the cake',
    body: 'Add or edit the final greeting so the order feels personal, not just AI-generated.',
    icon: MessageSquare,
  },
  {
    title: 'Delivery date planning',
    body: 'Set the target date before checkout so the order fits an actual Cebu celebration timeline.',
    icon: CalendarDays,
  },
] as const;

const trustPoints = [
  {
    title: 'Cebu-focused ordering',
    body: 'The page is written for real Metro Cebu cake buyers, not generic AI-art curiosity traffic.',
    icon: MapPin,
  },
  {
    title: 'Price before checkout',
    body: 'The goal is to answer whether your ChatGPT cake concept is doable before you place the order.',
    icon: BadgeDollarSign,
  },
  {
    title: 'Same flow Genie already uses',
    body: 'This route feeds into Genie.ph’s existing upload, analysis, customization, and ordering experience.',
    icon: ShieldCheck,
  },
] as const;

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
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-purple-400">{eyebrow}</p>
      <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{body}</p>
    </div>
  );
}

export default function ChatGptCakeDesignQuoteClient() {
  const router = useRouter();
  const uploadToastId = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageSelect = useCallback(
    (file: File) => {
      if (isUploading) return;

      const uploadToSupabase = async () => {
        const supabase = getSupabaseClient();
        const ext = file.name.split('.').pop() || 'jpg';
        const filename = `customizations/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`;

        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('cakegenie')
            .upload(filename, file);

          if (uploadError) {
            console.error('Upload failed:', uploadError);
            showError('Failed to upload your design. Please try again.');
            return null;
          }

          const { data: urlData } = supabase.storage.from('cakegenie').getPublicUrl(uploadData.path);
          return urlData.publicUrl;
        } catch (error) {
          console.error('Upload catch error:', error);
          showError('Failed to upload your design. Please try again.');
          return null;
        }
      };

      const processUpload = async () => {
        setIsUploading(true);
        uploadToastId.current = showLoading('Uploading your AI cake design...');

        try {
          const publicUrl = await uploadToSupabase();

          if (publicUrl) {
            await clearIndexedDB();
            router.push(`/customizing?ref=${encodeURIComponent(publicUrl)}&entry_source=landing`);
          }
        } finally {
          setIsUploading(false);
          if (uploadToastId.current) {
            toast.dismiss(uploadToastId.current);
            uploadToastId.current = null;
          }
        }
      };

      void processUpload();
    },
    [isUploading, router],
  );

  return (
    <div id="top" className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src={COMMON_ASSETS.logo} alt="Genie.ph" width={164} height={40} className="h-10 w-auto object-contain" />
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            <Link href="/customizing" className="text-sm font-medium text-slate-600 transition-colors hover:text-purple-700">
              Customize a Cake
            </Link>
            <Link href="/cake-price-calculator" className="text-sm font-medium text-slate-600 transition-colors hover:text-purple-700">
              Cake Price Calculator
            </Link>
            <Link href="/how-to-order" className="text-sm font-medium text-slate-600 transition-colors hover:text-purple-700">
              How to Order
            </Link>
          </nav>
          <Link href="#upload" className="genie-btn-primary rounded-full px-4 py-2 text-sm font-semibold">
            Upload design
          </Link>
        </div>
      </header>

      <main className="pb-16">
        <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-56 max-w-5xl rounded-full bg-radial from-pink-200/60 via-purple-200/30 to-transparent blur-3xl" />
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
              <div className="max-w-2xl">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/80 px-4 py-2 text-sm font-semibold text-purple-700 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  Turn AI cake ideas into real Cebu cake quotes
                </div>

                <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  {CHATGPT_CAKE_DESIGN_QUOTE_H1}
                </h1>

                <div className="mt-6 rounded-[1.8rem] border border-purple-200/70 bg-white/80 p-6 shadow-[0_24px_60px_-38px_rgba(88,28,135,0.75)] backdrop-blur">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-purple-400">
                    I made a cake design in ChatGPT. Can someone make this into a real cake?
                  </p>
                  <p className="mt-3 text-lg leading-8 text-slate-700">
                    Yes. If you made a cake design in ChatGPT, Genie.ph can help turn that image into a practical custom
                    cake quote in Cebu. Save the AI-generated cake image, upload it here, let Genie analyze the design,
                    then adjust the real-world order details before checkout.
                  </p>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {trustPoints.map(({ title, body, icon: Icon }) => (
                    <article key={title} className="genie-card genie-card-hover rounded-[1.6rem] p-5">
                      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-purple-700 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-base font-bold text-slate-900">{title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="#upload" className="genie-btn-primary rounded-full px-6 py-3 text-sm font-semibold">
                    Upload your ChatGPT design
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/customizing" className="genie-btn-secondary rounded-full px-6 py-3 text-sm font-semibold">
                    Open the full customizer
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Upload screenshots, downloads, or exported AI images
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm">
                    <Clock3 className="h-4 w-4 text-purple-400" />
                    Reuses Genie.ph&apos;s live quote flow
                  </span>
                </div>
              </div>

              <div id="upload" aria-busy={isUploading} className="relative">
                <div className="genie-card rounded-[2rem] p-4 sm:p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-purple-600">Start here</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Upload the cake image from ChatGPT</h2>
                    </div>
                    <div className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      Quote before checkout
                    </div>
                  </div>

                  <div className="relative">
                    {isUploading ? (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[1.55rem] bg-white/88 text-center shadow-sm backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        <p className="mt-4 text-base font-semibold text-slate-800">Uploading your AI cake design...</p>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                          We&apos;ll hand this straight into the existing Genie.ph customization flow once the image is ready.
                        </p>
                      </div>
                    ) : null}

                    <ImageUploader
                      isOpen
                      onClose={() => {}}
                      onImageSelect={handleImageSelect}
                      source="landing"
                      variant="inline"
                      title="Drop your ChatGPT cake image here"
                      browseLabel="Upload AI cake design"
                      className="border-0 bg-transparent shadow-none"
                    />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-purple-100 bg-white/85 p-4">
                      <p className="text-sm font-semibold text-slate-900">Best input</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        A saved ChatGPT image or clean screenshot where the cake is the main subject.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-white/85 p-4">
                      <p className="text-sm font-semibold text-slate-900">After upload</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Genie.ph analyzes the design, then lets you adjust size, flavor, message, and delivery timing.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="How it works"
              title="The exact flow from ChatGPT mockup to Genie.ph quote"
              body="This route is meant to answer the practical next step after generating a cake concept with AI: save the image, upload it, let Genie break down the design, then customize the order details before you decide to buy."
            />

            <div className="mt-10 grid gap-5 lg:grid-cols-5">
              {flowSteps.map(({ title, body, icon: Icon }, index) => (
                <article key={title} className="genie-card genie-card-hover rounded-[1.8rem] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-purple-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold text-purple-500">0{index + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <SectionHeading
              eyebrow="AI analysis"
              title="What Genie analyzes from your ChatGPT cake design"
              body="Genie.ph already describes this as an image-led cake quoting flow. The system reads the build and decorative details first, so the initial price estimate is tied to what is actually visible in the AI-generated design."
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {analysisPoints.map(({ title, body, icon: Icon }) => (
                <article key={title} className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
            <div className="grid gap-4 sm:grid-cols-2">
              {customizationPoints.map(({ title, body, icon: Icon }) => (
                <article key={title} className="genie-card rounded-[1.6rem] p-5">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </article>
              ))}
            </div>

            <SectionHeading
              eyebrow="Customize before checkout"
              title="The AI image starts the quote, but you still control the real order"
              body="The ChatGPT cake image gives Genie.ph a visual starting point. After analysis, you can make the order practical by adjusting the size, flavor, message, and delivery date before placing it."
            />
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Common questions"
              title="Short answers for buyers using ChatGPT cake concepts"
              body="This page is for people who already generated a cake idea and want to know whether a real baker can quote it. These are the main objections Genie.ph needs to answer before the upload."
            />

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {CHATGPT_CAKE_DESIGN_QUOTE_FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-[1.6rem] border border-slate-200 bg-white/90 px-5 py-4 shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-bold text-slate-900">
                    <span>{faq.question}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-[2.2rem] border border-purple-200 bg-linear-to-br from-purple-50 via-white to-pink-50/30 px-6 py-10 text-slate-900 shadow-[0_20px_50px_-25px_rgba(88,28,135,0.15)] sm:px-10">
              <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-600">Ready to test your AI design?</p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                    Upload the ChatGPT cake image and see the quote before you order
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-650 text-slate-600">
                    If the design is clear enough to save from ChatGPT, it is clear enough to start the Genie.ph flow.
                    Upload it now, open the full customizer, or review the step-by-step ordering guide first.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href="#upload" className="genie-btn-primary rounded-2xl px-5 py-4 text-center text-sm font-semibold transition-transform hover:-translate-y-0.5">
                    Upload now
                  </Link>
                  <Link href="/customizing" className="rounded-2xl border border-purple-200 bg-white px-5 py-4 text-center text-sm font-semibold text-purple-750 text-purple-700 transition-colors hover:bg-purple-50">
                    Open customizer
                  </Link>
                  <Link href="/cake-price-calculator" className="rounded-2xl border border-purple-200 bg-white px-5 py-4 text-center text-sm font-semibold text-purple-750 text-purple-700 transition-colors hover:bg-purple-50">
                    Cake price calculator
                  </Link>
                  <Link href="/how-to-order" className="rounded-2xl border border-purple-200 bg-white px-5 py-4 text-center text-sm font-semibold text-purple-750 text-purple-700 transition-colors hover:bg-purple-50">
                    How to order
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
