'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import LazyImage from '@/components/LazyImage';
import type { LandingHeroProduct } from '@/components/landing/landingHeroContent';

/**
 * Embla-powered hero peek carousel for the mobile landing page.
 *
 * This file is loaded via next/dynamic (ssr: false) from LandingClient so the
 * embla-carousel-react + embla-carousel-wheel-gestures bundles don't ship in
 * the initial JS for desktop users (who never see this component) or for
 * mobile users on first paint.
 *
 * useEmblaCarousel calls getBoundingClientRect synchronously on every slide
 * during init, which was costing ~400ms of forced reflow during LCP. Splitting
 * the import + gating the mount in LandingClient via useShouldMountCarousel
 * pulls that work out of the LCP critical path.
 */
export default function HeroProductPeekCarouselEmbla({
    products,
    heroProductIndex,
    onSelectProduct,
    onInteraction,
    cardSpacingClassName = 'mx-1',
    cardFlexStyle = '0 0 min(calc(50% - 8px), 232px)',
    aspectClassName = 'aspect-[3/2]',
}: {
    products: readonly LandingHeroProduct[];
    heroProductIndex: number;
    onSelectProduct: (index: number) => void;
    onInteraction?: (index: number) => void;
    cardSpacingClassName?: string;
    cardFlexStyle?: string;
    aspectClassName?: string;
}) {
    const wheelGestures = useMemo(() => [WheelGesturesPlugin()], []);
    const userTriggeredSelectionRef = useRef(false);
    const [emblaRef, emblaApi] = useEmblaCarousel(
        {
            align: 'center',
            dragFree: false,
            duration: 28,
            loop: true,
            skipSnaps: false,
        },
        wheelGestures
    );

    useEffect(() => {
        if (!emblaApi || emblaApi.selectedScrollSnap() === heroProductIndex) return;
        emblaApi.scrollTo(heroProductIndex);
    }, [emblaApi, heroProductIndex]);

    useEffect(() => {
        if (!emblaApi) return;

        const syncSelectedProduct = () => {
            const selectedIndex = emblaApi.selectedScrollSnap();
            onSelectProduct(selectedIndex);

            if (userTriggeredSelectionRef.current) {
                onInteraction?.(selectedIndex);
                userTriggeredSelectionRef.current = false;
            }
        };

        syncSelectedProduct();
        emblaApi.on('select', syncSelectedProduct);
        emblaApi.on('reInit', syncSelectedProduct);

        const handlePointerDown = () => {
            userTriggeredSelectionRef.current = true;
        };

        emblaApi.on('pointerDown', handlePointerDown);

        return () => {
            emblaApi.off('select', syncSelectedProduct);
            emblaApi.off('reInit', syncSelectedProduct);
            emblaApi.off('pointerDown', handlePointerDown);
        };
    }, [emblaApi, onSelectProduct, onInteraction]);

    const handleProductClick = (index: number) => {
        userTriggeredSelectionRef.current = true;
        onSelectProduct(index);
        emblaApi?.scrollTo(index);
    };

    return (
        <div className={`relative w-full overflow-hidden bg-transparent ${aspectClassName}`}>
            <div ref={emblaRef} className="h-full overflow-hidden cursor-grab active:cursor-grabbing">
                <div className="flex h-full touch-pan-y">
                    {products.map((product, productIndex) => {
                        const isCenter = productIndex === heroProductIndex;

                        return (
                            <button
                                key={product.title}
                                type="button"
                                onClick={() => handleProductClick(productIndex)}
                                aria-label={isCenter ? `${product.title} example` : `View ${product.title}`}
                                className={`relative ${cardSpacingClassName} h-full min-w-0 overflow-hidden rounded-[1.35rem] bg-slate-100 transition-shadow duration-500 ease-out ${isCenter ? 'shadow-[0_18px_45px_-28px_rgba(15,23,42,0.75)]' : ''
                                    }`}
                                style={{ flex: cardFlexStyle }}
                            >
                                <LazyImage
                                    src={product.image}
                                    alt={`${product.title} example`}
                                    fill
                                    priority={productIndex === 0}
                                    loading={productIndex === 0 ? 'eager' : 'lazy'}
                                    fetchPriority={productIndex === 0 ? 'high' : 'low'}
                                    decoding="async"
                                    unoptimized
                                    sizes="(max-width: 767px) 50vw, (max-width: 1279px) 40vw, 380px"
                                    imageClassName={`object-cover transition-transform duration-700 ${isCenter ? 'scale-[1.1]' : 'scale-100'}`}
                                    aria-hidden={!isCenter}
                                    draggable={false}
                                />
                                {isCenter && (
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/25 to-transparent" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="absolute bottom-3 left-0 right-0 z-30 flex justify-center gap-1.5">
                {products.map((_, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => handleProductClick(i)}
                        aria-label={`View ${products[i].title}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === heroProductIndex ? 'w-5 bg-white shadow-sm' : 'w-1.5 bg-white/55 hover:bg-white/80'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
