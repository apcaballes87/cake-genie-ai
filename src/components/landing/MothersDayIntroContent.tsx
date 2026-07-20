import Link from 'next/link';

export function MothersDayIntroContent() {
  return (
    <section className="py-4 md:py-6">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-4 text-[22px] font-bold text-gray-900 md:text-[28px]">
          Looking for the best Mother&apos;s Day cake in Cebu this 2026?
        </h2>
        <div className="prose prose-base mx-auto space-y-4 text-gray-600 md:prose-lg md:space-y-6">
          <p>
            <strong>Mother&apos;s Day 2026 falls on Sunday, May 10, 2026,</strong> and the
            sweetest gifts are the ones that feel thoughtful, beautiful, and personal. Genie.ph
            helps you buy a Mother&apos;s Day cake online with instant pricing, trusted Cebu bakers,
            and custom designs made for moms, grandmothers, wives, and every mother figure worth
            celebrating.
          </p>

          <p>
            Whether you want a floral cake for family lunch, a photo cake with your favorite
            memories, or a minimalist message cake that says thank you in the most heartfelt way,
            you can compare styles quickly and order without the usual back-and-forth.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm font-semibold text-purple-700 md:grid-cols-4">
            <Link
              href="/collections/mothers-day-cakes"
              className="rounded-lg bg-purple-50 px-4 py-2 transition hover:bg-purple-100"
            >
              Mother&apos;s Day Cakes
            </Link>
            <Link
              href="/collections/floral-cake"
              className="rounded-lg bg-purple-50 px-4 py-2 transition hover:bg-purple-100"
            >
              Floral Cakes for Mom
            </Link>
            <Link
              href="/collections"
              className="rounded-lg bg-purple-50 px-4 py-2 transition hover:bg-purple-100"
            >
              Photo Cakes for Mom
            </Link>
            <Link
              href="/collections/minimalist-cake"
              className="rounded-lg bg-purple-50 px-4 py-2 transition hover:bg-purple-100"
            >
              Minimalist Cakes for Mom
            </Link>
          </div>

          <p className="mt-5">
            This Mother&apos;s Day, give a cake that feels more personal than a last-minute grocery
            dessert: something made with love for the woman who made home feel like home.
          </p>
        </div>
      </div>
    </section>
  );
}
