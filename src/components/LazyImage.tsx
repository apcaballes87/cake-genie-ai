'use client';
import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';
import type { VariantManifest } from '@/lib/imageVariants/types';
import { buildSrcSet, pickFallbackSrc } from '@/lib/imageVariants/manifest';

interface LazyImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  placeholderClassName?: string;
  containerClassName?: string;
  imageClassName?: string;
  title?: string;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void; // Update to match native event if needed, but next/image onLoad is slightly different
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  /**
   * Optional variant manifest from `cakegenie_analysis_cache.image_variants`.
   * When non-null AND has at least one variant, the component renders a
   * `<picture>` wrapper around `next/image` with a `<source type="image/webp"
   * srcset="...">` so the browser picks the smallest variant that fits the
   * viewport. Render output when `variants` is null/undefined/empty is
   * byte-identical to the pre-variants behavior — existing call sites that
   * don't pass this prop see no change.
   *
   * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
   *       Req 6.1, 6.6, 5.2, 10.2
   */
  variants?: VariantManifest | null;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholderClassName,
  containerClassName,
  imageClassName,
  title,
  onLoad,
  onError,
  priority = false,
  fill = false,
  width,
  height,
  unoptimized,
  fetchPriority,
  decoding,
  variants,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad(e);
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    setIsLoaded(true); // Stop loading/skeleton
    if (onError) {
      onError(e);
    }
  };

  // If fill is true, the wrapper should be absolute to mimic next/image behavior
  // properly within a relative container.
  // We also default to fill if no dimensions are provided to prevent next/image runtime errors.
  const isFilling = fill || (width === undefined && height === undefined);
  const positionClass = isFilling ? 'absolute inset-0 w-full h-full' : 'relative';

  // Variant manifest handling. When the manifest has any variants we wrap
  // <Image> in <picture> with a WebP <source>, and choose `effectiveSrc`
  // from the manifest so the visible <img> URL matches a variant the
  // browser may have already pre-cached via the <source srcset>. When the
  // manifest is null/empty, we render exactly as before — no extra DOM
  // and no behavior change for existing call sites (Req 5.2, 6.6).
  const hasVariants = variants && variants.variants.length > 0;
  const manifestSrcSet = hasVariants ? buildSrcSet(variants) : '';
  // Fall back through: largest variant ≤ 1200 → original src prop. Use
  // the original `src` as the absolute floor so the <img> always has a
  // value even if `pickFallbackSrc` somehow returns null.
  const variantFallbackSrc = hasVariants ? pickFallbackSrc(variants, 1200) : null;
  const effectiveSrc = variantFallbackSrc ?? src;

  const sizes = props.sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';

  const imageElement = (
    <Image
      src={effectiveSrc}
      alt={alt}
      title={title}
      onLoad={handleLoad}
      onError={handleError}
      priority={priority}
      fill={isFilling}
      width={!isFilling ? width : undefined}
      height={!isFilling ? height : undefined}
      sizes={sizes}
      className={`transition-opacity ${priority ? 'duration-0' : 'duration-200'} ${isLoaded || priority ? 'opacity-100' : 'opacity-0'} ${isFilling && !imageClassName?.includes('object-') ? 'object-cover' : ''} ${imageClassName || ''}`}
      unoptimized={unoptimized}
      fetchPriority={fetchPriority}
      decoding={decoding}
      {...props}
    />
  );

  return (
    <div className={`${positionClass} overflow-hidden ${containerClassName || ''} ${placeholderClassName || ''} ${className || ''}`}>

      {hasError && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-100 text-slate-300 z-10">
          <ImageOff size={24} />
        </div>
      )}

      {hasVariants ? (
        // Why <picture><source> instead of just letting next/image apply
        // its own optimization: with `images.unoptimized: true` set in
        // next.config.ts (deliberate, to avoid Vercel image-credit usage),
        // next/image emits a single <img src> with no srcset of its own.
        // The <source srcset> here is what gives the browser actual
        // responsive choices. Req 6.1, 6.7, 10.2.
        <picture>
          <source type="image/webp" srcSet={manifestSrcSet} sizes={sizes} />
          {imageElement}
        </picture>
      ) : (
        imageElement
      )}
    </div>
  );
};

export default LazyImage;
