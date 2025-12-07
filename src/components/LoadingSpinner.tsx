'use client';
import React from 'react';

export const LoadingSpinner: React.FC = React.memo(() => {
  return (
    <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-purple-500"></div>
  );
});
LoadingSpinner.displayName = 'LoadingSpinner';
