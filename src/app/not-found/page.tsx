import React from 'react';
import { useCanonicalUrl } from '../../hooks';

interface NotFoundPageProps {
    onGoHome: () => void;
}

const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
    useCanonicalUrl('/404');

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
                <div className="mb-6">
                    <div className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 mb-2">
                        404
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                        Page Not Found
                    </h1>
                    <p className="text-slate-600">
                        The page or discount code you're looking for doesn't exist.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={onGoHome}
                        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    >
                        Go to Home
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200">
                    <p className="text-sm text-slate-500">
                        Looking for a discount code? Contact us to get the latest offers!
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;
