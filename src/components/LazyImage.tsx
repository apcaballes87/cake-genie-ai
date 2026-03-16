'use client';
import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';

interface LazyImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  placeholderClassName?: string;
  containerClassName?: string;
  imageClassName?: string;
  title?: string;
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

  return (
    <div className={`${positionClass} overflow-hidden ${containerClassName || ''} ${placeholderClassName || ''} ${className || ''}`}>

      {hasError && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-100 text-slate-300 z-10">
          <ImageOff size={24} />
        </div>
      )}

      <Image
        src={src}
        alt={alt}
        title={title}
        onLoad={handleLoad}
        onError={handleError}
        priority={priority}
        fill={isFilling}
        width={!isFilling ? width : undefined}
        height={!isFilling ? height : undefined}
        sizes={props.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        className={`transition-opacity ${priority ? 'duration-0' : 'duration-200'} ${isLoaded || priority ? 'opacity-100' : 'opacity-0'} ${isFilling ? 'object-cover' : ''} ${imageClassName || ''}`}
        unoptimized={unoptimized}
        fetchPriority={fetchPriority}
        decoding={decoding}
        {...props}
      />
    </div>
  );
};

export default LazyImage;