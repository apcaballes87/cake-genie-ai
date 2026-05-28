import React from 'react';

/**
 * Decorative gradient blobs behind the homepage hero.
 *
 * Previously this lived in the root layout with a `usePathname` guard so it
 * only rendered on `/`. That meant every other route still had to hydrate this
 * client component just to render `null`. Now it's a server component imported
 * directly by `app/page.tsx` and never loaded on other routes.
 */
const AnimatedBlobs = () => {
    return (
        <div className="absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
            <div className="absolute w-96 h-96 bg-pink-200/30 rounded-full opacity-50 top-1/4 left-1/4"></div>
            <div className="absolute w-80 h-80 bg-purple-200/30 rounded-full opacity-50 bottom-1/4 right-1/4"></div>
            <div className="absolute w-72 h-72 bg-indigo-200/30 rounded-full opacity-50 bottom-1/2 left-1/3"></div>
        </div>
    );
};

export default AnimatedBlobs;
