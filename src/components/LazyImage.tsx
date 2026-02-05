'use client';
import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { Skeleton } from './LoadingSkeletons';
import { ImageOff } from 'lucide-react';

interface LazyImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  placeholderClassName?: string;
  containerClassName?: string;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void; // Update to match native event if needed, but next/image onLoad is slightly different
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholderClassName,
  containerClassName,
  onLoad,
  onError,
  priority = false,
  fill = false,
  width,
  height,
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

  // If fill is true, we don't need width/height. If fill is false, we might need them.
  // next/image requires width/height if fill=false, unless imported static image.
  // Assuming usage provides necessary props.

  return (
    <div className={`relative overflow-hidden ${containerClassName || ''} ${placeholderClassName || ''} ${className || ''}`}>
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
        className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${fill ? 'object-cover' : ''}`}
        {...props}
      />
    </div>
  );
};

export default LazyImage;