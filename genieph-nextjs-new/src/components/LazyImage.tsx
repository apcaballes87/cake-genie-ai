'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from './LoadingSkeletons';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholderClassName?: string;
  eager?: boolean;
  preventFlickerOnUpdate?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholderClassName,
  onLoad,
  eager = false,
  preventFlickerOnUpdate = false,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(eager);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (eager || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '200px 0px' }
    );

    const currentContainerRef = containerRef.current;
    if (currentContainerRef) {
      observer.observe(currentContainerRef);
    }

    return () => {
      if (currentContainerRef) {
        observer.unobserve(currentContainerRef);
      }
    };
  }, [src, eager]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad(e);
    }
  };

  useEffect(() => {
    // When the src changes, reset the loaded state, but only if we want the flicker.
    if (!preventFlickerOnUpdate) {
      setIsLoaded(false);
    }
    if (eager) {
      setIsInView(true);
    }
  }, [src, eager, preventFlickerOnUpdate]);

  // Fix for cached images: Check if image is already complete after render
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src, isInView]);

  return (
    // The container should take up the space defined by className to prevent layout shift
    <div ref={containerRef} className={`relative overflow-hidden ${className} ${placeholderClassName || ''}`}>
      {!isLoaded && (
        // The skeleton is absolutely positioned to fill the container
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      {isInView && src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          // The image also takes the className to fill the container
          className={`${className} transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;