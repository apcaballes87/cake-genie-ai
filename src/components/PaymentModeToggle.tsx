// Simple payment mode toggle component for testing

import React, { useState, useEffect } from 'react';

const PAYMENT_MODE_KEY = 'xendit_payment_mode';

export type PaymentMode = 'test' | 'live';

export function usePaymentMode() {
    const [mode, setMode] = useState<PaymentMode>(() => {
        if (typeof window === 'undefined') return 'test';
        return (localStorage.getItem(PAYMENT_MODE_KEY) as PaymentMode) || 'test';
    });

    const toggleMode = (newMode: PaymentMode) => {
        setMode(newMode);
        localStorage.setItem(PAYMENT_MODE_KEY, newMode);
    };

    return { mode, toggleMode, isLiveMode: mode === 'live' };
}

export function PaymentModeToggle() {
    const { mode, toggleMode } = usePaymentMode();

    return (
        <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg p-4 border-2 border-slate-200">
            <div className="text-xs font-semibold text-slate-600 mb-2">Payment Mode</div>
            <div className="flex gap-2">
                <button
                    onClick={() => toggleMode('test')}
                    className={`px-3 py-1.5 text-sm rounded font-medium transition-all ${mode === 'test'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    🧪 Test
                </button>
                <button
                    onClick={() => toggleMode('live')}
                    className={`px-3 py-1.5 text-sm rounded font-medium transition-all ${mode === 'live'
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    💳 Live
                </button>
            </div>
            {mode === 'live' && (
                <div className="mt-2 text-xs text-red-600 font-semibold">
                    ⚠️ Real payments active!
                </div>
            )}
        </div>
    );
}
