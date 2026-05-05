import Image from 'next/image';
import React from 'react';

const TRANSITION_IMAGE_SRC =
  'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/generic-vs-personal-cake.webp';

export function HeroTransitionSection() {
  return (
    <section aria-label="Why personal cakes feel different" className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-12">
        <div className="text-left">
          <h2 className="max-w-2xl text-[clamp(1.9rem,4.2vw,3.35rem)] font-black leading-[0.94] tracking-tight text-slate-900">
            <span className="block">Generic Cakes make generic celebrations.</span>
            <span className="mt-4 block max-w-xl text-[0.5em] font-semibold leading-[1.05] text-purple-500">
              Give a cake that feels more personal and thoughtful
            </span>
          </h2>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-slate-100 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.55)]">
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
    </section>
  );
}
