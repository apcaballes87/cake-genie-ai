import Image from 'next/image';
import React from 'react';

const TRANSITION_IMAGE_SRC =
  'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/generic-vs-personal-cake.webp';

export function HeroTransitionSection() {
  return (
    <section aria-label="Why personal cakes feel different" className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative order-1 aspect-[21/9] overflow-hidden rounded-[2rem] bg-slate-100 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.55)] md:order-none">
          <Image
            src={TRANSITION_IMAGE_SRC}
            alt="Generic cake compared with a more personal cake"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-transparent" />
        </div>

        <div className="order-2 text-center md:order-none md:text-center">
          <h2 className="max-w-2xl text-[clamp(1.9rem,4.2vw,3.35rem)] font-black leading-[0.94] tracking-tight text-slate-900">
            <span className="block">Generic Cakes make generic celebrations.</span>
            <span className="mt-4 block max-w-xl text-[calc(0.5em-1px)] font-normal leading-[1.1] text-purple-300 mx-auto">
              Give a cake that feels more personal and thoughtful. Available today.
            </span>
          </h2>
        </div>
      </div>
    </section>
  );
}
