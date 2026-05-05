import Image from 'next/image';
import React from 'react';

const TRANSITION_IMAGE_SRC =
  'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/generic-vs-personal-cake.webp';

export function HeroTransitionSection() {
  return (
    <section aria-label="Why personal cakes feel different" className="px-4 sm:px-6 lg:px-8 py-5 md:py-7">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/80 shadow-[0_28px_70px_-44px_rgba(88,28,135,0.72)] backdrop-blur-xl">
          <div className="grid items-stretch md:grid-cols-[1.08fr_0.92fr]">
            <div className="relative flex flex-col justify-center gap-4 bg-gradient-to-br from-white via-fuchsia-50/70 to-purple-50/90 px-6 py-8 sm:px-8 md:px-10 md:py-10">
              <h2 className="max-w-2xl text-[clamp(1.7rem,4vw,3.15rem)] font-black leading-[0.98] tracking-tight text-slate-900">
                <span className="block">Generic Cakes make generic celebrations.</span>
                <span className="mt-2 block text-purple-500">
                  Give a cake that feels more personal and thoughtful.
                </span>
              </h2>

              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Available Today.
              </p>
            </div>

            <div className="relative min-h-[260px] overflow-hidden bg-slate-100 md:min-h-[340px]">
              <Image
                src={TRANSITION_IMAGE_SRC}
                alt="Generic cake compared with a more personal cake"
                fill
                sizes="(max-width: 768px) 100vw, 45vw"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
