'use client';
import React from 'react';
import { usePathname } from 'next/navigation';

const AnimatedBlobs = () => {
    const pathname = usePathname();
    if (pathname !== '/') return null;

    return (
        <div className="absolute inset-0 overflow-hidden -z-10">
            <div className="absolute w-96 h-96 bg-pink-200/30 rounded-full opacity-50 top-1/4 left-1/4"></div>
            <div className="absolute w-80 h-80 bg-purple-200/30 rounded-full opacity-50 bottom-1/4 right-1/4"></div>
            <div className="absolute w-72 h-72 bg-indigo-200/30 rounded-full opacity-50 bottom-1/2 left-1/3"></div>
        </div>
    );
};

export default AnimatedBlobs;
