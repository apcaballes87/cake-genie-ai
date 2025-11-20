import React, { lazy, Suspense } from 'react';
import { Skeleton } from './LoadingSkeletons';

const ImageUploaderCore = lazy(() => import('./ImageUploader').then(module => ({ default: module.ImageUploader })));

import { ImageUploaderProps } from './ImageUploader';

export const ImageUploader: React.FC<ImageUploaderProps> = (props) => (
  <Suspense fallback={<Skeleton className="w-full h-64" />}>
    <ImageUploaderCore {...props} />
  </Suspense>
);