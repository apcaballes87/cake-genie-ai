'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CreatorsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Creators route error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-transparent">
            <div className="max-w-lg w-full bg-white/95 rounded-3xl shadow-xl border border-purple-100/50 p-6 sm:p-8 text-center space-y-5">
                <h1 className="text-2xl font-extrabold text-gray-900">Something went wrong</h1>
                <p className="text-gray-600 text-sm leading-relaxed">
                    We couldn&apos;t load this page. Please try again — if the problem continues, head back home.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="genie-btn-primary font-bold py-3 px-6 rounded-xl shadow-md"
                    >
                        Try again
                    </button>
                    <Link href="/" className="genie-btn-secondary font-bold py-3 px-6 rounded-xl">
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
