import React, { lazy, Suspense } from 'react';
import { Skeleton } from './LoadingSkeletons';

const ImageUploaderCore = lazy(() => import('./ImageUploader').then(module => ({ default: module.ImageUploader })));

export const ImageUploader: React.FC<any> = (props) => (
  <Suspense fallback={<Skeleton className="w-full h-64" />}>
    <ImageUploaderCore {...props} />
  </Suspense>
);