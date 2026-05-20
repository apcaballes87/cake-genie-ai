'use client';
import React from 'react';

export interface LoadingSpinnerProps {
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({ className }) => {
  const defaultClasses = "w-12 h-12 border-4 border-dashed rounded-full animate-spin border-purple-500";
  const mergedClasses = className 
    ? `animate-spin rounded-full border-2 border-solid ${className}`
    : defaultClasses;
  return (
    <div className={mergedClasses}></div>
  );
});
LoadingSpinner.displayName = 'LoadingSpinner';
