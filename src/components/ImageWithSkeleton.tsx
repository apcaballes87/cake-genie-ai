'use client';
import React, { useState } from 'react';
import { Skeleton } from './LoadingSkeletons';

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  width?: string | number;
  height?: string | number;
  onLoad?: () => void;
  priority?: boolean;
}

export const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className,
  skeletonClassName,
  onLoad,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  return (
    <div className={`relative ${className}`}>
      {!isLoaded && !priority && (
        <div className={`absolute inset-0 z-10 ${skeletonClassName}`}>
          <Skeleton className="w-full h-full" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={`transition-opacity duration-200 ${isLoaded || priority ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
