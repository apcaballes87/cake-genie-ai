'use client'

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CopyIcon as Copy, CheckCircle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/utils/toast';

export function SharedDesignBackButton() {
    const router = useRouter();

    const handleNavigateHome = () => {
        router.push('/');
    };

    return (
        <button onClick={handleNavigateHome} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
            <ArrowLeft />
        </button>
    );
}

export function SharedDesignCopyButton() {
    const [isCopying, setIsCopying] = useState(false);

    const handleCopyLink = () => {
        setIsCopying(true);
        navigator.clipboard.writeText(window.location.href).then(() => {
            showSuccess("Link copied to clipboard!");
            setTimeout(() => setIsCopying(false), 2000);
        }).catch(() => {
            showError("Failed to copy link.");
            setIsCopying(false);
        });
    };

    return (
        <button onClick={handleCopyLink} className="p-2.5 bg-white/80 backdrop-blur-md rounded-full shadow-md hover:bg-white transition-colors">
            {isCopying ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-slate-600" />}
        </button>
    );
}
