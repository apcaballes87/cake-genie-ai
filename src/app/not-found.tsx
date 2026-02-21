import { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="text-center max-w-md mx-auto">
                <div className="bg-pink-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-pink-500" />
                </div>
                <h1 className="text-4xl font-bold text-slate-800 mb-4">Page Not Found</h1>
                <p className="text-slate-600 mb-8 text-lg">
                    Oops! The cake you're looking for seems to have been eaten... or the page just doesn't exist.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center px-8 py-3 bg-linear-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                    Return Home
                </Link>
            </div>
        </div>
    );
}
