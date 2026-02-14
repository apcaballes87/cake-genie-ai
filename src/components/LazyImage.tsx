'use client';
import React, { useState, useMemo } from 'react';
import Image, { ImageProps } from 'next/image';
import { Skeleton } from './LoadingSkeletons';
import { ImageOff } from 'lucide-react';

// Our own Supabase storage domains that are safe for next/image optimization.
const OWN_SUPABASE_DOMAINS = [
  'cqmhanqnfybyxezhobkx.supabase.co',
  'congofivupobtfudnhni.supabase.co',
];

/**
 * Simple check: if the URL is NOT from our own Supabase storage, it's external
 * and should be unoptimized to avoid 400 errors from unreliable external servers.
 */
const shouldUseUnoptimized = (src: string | undefined): boolean => {
  if (!src || typeof src !== 'string') return false;

  // Relative URLs are always safe (local images)
  if (src.startsWith('/') || src.startsWith('data:')) return false;

  // Simple check: is it from our own Supabase storage?
  const isOwnSupabase = OWN_SUPABASE_DOMAINS.some(domain => src.includes(domain));

  // If it IS our own Supabase, we prevent Next.js optimization to save costs/limits.
  if (isOwnSupabase) return true;

  // For other external domains, default to unoptimized to be safe/consistent with previous logic if desired,
  // or return false if you want to optimize other external images. 
  // Based on context, we likely want to unoptimize everything external if we are hitting limits.
  return true;
};

interface LazyImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  placeholderClassName?: string;
  containerClassName?: string;
  imageClassName?: string;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void; // Update to match native event if needed, but next/image onLoad is slightly different
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholderClassName,
  containerClassName,
  imageClassName,
  onLoad,
  onError,
  priority = false,
  fill = false,
  width,
  height,
  unoptimized,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Determine if we should skip next/image optimization for this URL
  const useUnoptimized = useMemo(() => {
    // If explicitly set, use that value
    if (typeof unoptimized === 'boolean') return unoptimized;
    // Otherwise, check if the domain is whitelisted
    return shouldUseUnoptimized(typeof src === 'string' ? src : undefined);
  }, [src, unoptimized]);

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
  const positionClass = fill ? 'absolute inset-0 w-full h-full' : 'relative';

  return (
    <div className={`${positionClass} overflow-hidden ${containerClassName || ''} ${placeholderClassName || ''} ${className || ''}`}>
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0 w-full h-full z-10" />
      )}

      {hasError && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-100 text-slate-300 z-10">
          <ImageOff size={24} />
        </div>
      )}

      <Image
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        priority={priority}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={props.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${fill ? 'object-cover' : ''} ${imageClassName || ''}`}
        unoptimized={useUnoptimized}
        {...props}
      />
    </div>
  );
};

export default LazyImage;