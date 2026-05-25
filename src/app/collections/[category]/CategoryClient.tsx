'use client';

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import MobileBottomNav from '@/components/MobileBottomNav';
import { DesignGridWithLoadMore } from '@/components/collections/DesignGridWithLoadMore';
import { useCart } from '@/contexts/CartContext';

interface Design {
    slug: string;
    p_hash: string;
    original_image_url: string;
    price: number | null;
    keywords: string | string[];
    availability?: string | null;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    };
    image_width?: number | null;
    image_height?: number | null;
}

interface CategoryClientProps {
    designs: Design[];
    keyword: string;
    readableTitle: string;
    category: string;
    description?: string | null;
    designCount: number;
    heading: string;
    intro: string;
    tagHighlights: string[];
}

function buildFaqItems(readableTitle: string) {
    const title = readableTitle.toLowerCase();

    return [
        {
            question: `Can I customize the colors, message, or size for these ${title} designs?`,
            answer: `Yes. Each design in this collection can be used as a starting point, then adjusted for size, color palette, message, toppers, and delivery timing inside the Genie.ph customizer.`,
        },
        {
            question: `Do you deliver ${title} orders in Cebu?`,
            answer: 'Yes. Genie.ph connects you with Cebu bakers and delivery options, so you can compare designs, see pricing, and place an order for delivery or pickup in Metro Cebu.',
        },
        {
            question: `How do I order a ${title} cake faster?`,
            answer: 'Start with a design that already matches the look you want, keep the edits focused, and check the available delivery timing during customization. Simpler changes usually move faster than fully custom builds.',
        },
    ];
}

const CategoryClient: React.FC<CategoryClientProps> = ({
    designs,
    keyword,
    readableTitle,
    category,
    description,
    designCount,
    heading,
    intro,
    tagHighlights,
}) => {
    const router = useRouter();
    const { itemCount } = useCart();
    const [searchInput, setSearchInput] = useState('');
    const [isScrolled, setIsScrolled] = useState(false);
    const mounted = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false,
    );

    useEffect(() => {
        const updateScrollState = () => {
            setIsScrolled(window.scrollY > 12);
        };
        updateScrollState();
        window.addEventListener('scroll', updateScrollState, { passive: true });
        return () => window.removeEventListener('scroll', updateScrollState);
    }, []);

    const handleSearch = useCallback((query: string) => {
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
    }, [router]);

    const faqItems = useMemo(() => buildFaqItems(readableTitle), [readableTitle]);
    const visibleDescription = description || intro;

    return (
        <div className="min-h-screen pb-24 md:pb-0">
            <div className={`fixed top-0 left-0 right-0 z-80 border-b transition-all duration-200 ${isScrolled ? 'border-purple-100 bg-white/90 shadow-sm backdrop-blur-lg' : 'border-transparent bg-white'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="w-full flex items-center gap-2 md:gap-4 py-[11px] md:py-[14px]">
                        <Link href="/collections" className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label="Go back">
                            <ArrowLeft />
                        </Link>
                        <div className="relative grow">
                            <SearchAutocomplete
                                value={searchInput}
                                onChange={setSearchInput}
                                onSearch={handleSearch}
                                onUploadClick={() => router.push('/customizing')}
                                showUploadButton={true}
                                placeholder="Search cake designs..."
                                inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>
                        <button
                            onClick={() => router.push('/cart')}
                            className="relative p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                            aria-label={`View cart with ${mounted ? itemCount : 0} items`}
                        >
                            <ShoppingBag size={24} />
                            {mounted && itemCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white text-[10px] font-bold">
                                    {itemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-[66px] md:h-[74px]"></div>

            <div className="w-full max-w-7xl mx-auto px-4">
                <nav className="mb-6" aria-label="Breadcrumb">
                    <ol className="flex items-center text-sm text-slate-500 space-x-2">
                        <li><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                        <li>/</li>
                        <li><Link href="/collections" className="hover:text-purple-600 transition-colors">Collections</Link></li>
                        <li>/</li>
                        <li className="text-slate-800 font-medium">{readableTitle}</li>
                    </ol>
                </nav>

                <header className="mb-10 max-w-4xl">
                    <h1 className="text-2xl md:text-4xl font-bold text-slate-900">
                        {heading}
                    </h1>
                    <p className="mt-3 text-base text-slate-600 leading-relaxed">
                        {visibleDescription}
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                        {designCount.toLocaleString()} designs available to browse, customize, and price online.
                    </p>
                    {tagHighlights.length > 0 && (
                        <p className="mt-2 text-sm text-slate-500">
                            Popular themes: {tagHighlights.join(', ')}.
                        </p>
                    )}
                </header>

                <DesignGridWithLoadMore initialDesigns={designs} keyword={keyword} collectionTitle={readableTitle} />

                <section className="mt-16 border-t border-slate-200 pt-10">
                    <div className="max-w-5xl grid gap-8 lg:grid-cols-[1.4fr_1fr]">
                        <div>
                            <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                                How to order this collection
                            </h2>
                            <ol className="mt-4 space-y-4 text-slate-600">
                                <li>
                                    <span className="font-semibold text-slate-900">1. Choose a design that is close to your brief.</span> Starting from a similar design usually gets you a cleaner result and a more reliable quote.
                                </li>
                                <li>
                                    <span className="font-semibold text-slate-900">2. Open the design in the customizer.</span> Adjust the cake size, message, colors, toppers, and other details before you check out.
                                </li>
                                <li>
                                    <span className="font-semibold text-slate-900">3. Review pricing and delivery timing.</span> Genie.ph shows pricing and available order timing so you can move faster with Cebu delivery or pickup.
                                </li>
                            </ol>
                        </div>

                        <div>
                            <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                                Useful next steps
                            </h2>
                            <div className="mt-4 space-y-3 text-sm text-slate-600">
                                <p>
                                    Need a broader starting point? Browse the{' '}
                                    <Link href="/collections" className="font-semibold text-purple-700 hover:text-purple-800">
                                        full collections directory
                                    </Link>
                                    .
                                </p>
                                <p>
                                    Want to edit a similar style from scratch? Open the{' '}
                                    <Link href={`/customizing/category/${category}`} className="font-semibold text-purple-700 hover:text-purple-800">
                                        matching customizer category
                                    </Link>
                                    .
                                </p>
                                <p>
                                    If you already have a reference image, jump straight into{' '}
                                    <Link href="/customizing" className="font-semibold text-purple-700 hover:text-purple-800">
                                        the AI cake customizer
                                    </Link>
                                    {' '}or use the{' '}
                                    <Link href="/cake-price-calculator" className="font-semibold text-purple-700 hover:text-purple-800">
                                        cake price calculator
                                    </Link>
                                    .
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-14 border-t border-slate-200 pt-10">
                    <div className="max-w-4xl">
                        <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                            More about {readableTitle}
                        </h2>
                        <p className="mt-4 text-slate-600 leading-relaxed">
                            {intro}
                        </p>
                        <p className="mt-4 text-slate-600 leading-relaxed">
                            These collection pages are built to help you compare real design directions before you customize, instead of starting from a blank screen. That usually leads to better search relevance, better user decisions, and stronger order intent once you move into customization.
                        </p>
                    </div>
                </section>

                <section className="mt-14 border-t border-slate-200 pt-10 pb-10">
                    <div className="max-w-4xl">
                        <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                            Questions about {readableTitle}
                        </h2>
                        <div className="mt-5 space-y-3">
                            {faqItems.map((item) => (
                                <details key={item.question} className="border border-slate-200 rounded-lg px-4 py-3 bg-white">
                                    <summary className="cursor-pointer list-none font-medium text-slate-900">
                                        {item.question}
                                    </summary>
                                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                                        {item.answer}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <MobileBottomNav />
        </div>
    );
};

export default CategoryClient;
