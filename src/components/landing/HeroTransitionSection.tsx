import Image from 'next/image';
import React from 'react';
import { HOMEPAGE_ASSETS } from '@/constants';

const TRANSITION_IMAGE_SRC = HOMEPAGE_ASSETS.transition;

export function HeroTransitionSection() {
  return (
    <section aria-label="Why personal cakes feel different" className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="order-1 text-center md:order-none md:text-center">
          <h2 className="font-display max-w-2xl text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--genie-ink)]">
            <span className="block">Generic cakes make generic celebrations.</span>
            <span className="mt-4 block max-w-xl font-sans text-base font-normal leading-relaxed text-[var(--genie-muted)] mx-auto">
              Give a cake that feels more personal and thoughtful. Available today.
            </span>
          </h2>
        </div>

        <div className="relative order-2 aspect-[21/9] overflow-hidden rounded-3xl bg-[var(--genie-cream-deep)] md:order-none">
          <Image
            src={TRANSITION_IMAGE_SRC}
            alt="Generic cake compared with a more personal cake"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
}
