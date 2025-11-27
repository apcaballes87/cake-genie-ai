import React, { useState } from 'react';
import { Copy, Check, Share2, ExternalLink } from 'lucide-react';
import { formatCurrency } from '../lib/utils/currency';

interface SplitOrderShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareLink: string;
    orderNumber: string;
    splitCount: number;
    totalAmount: number;
}

export const SplitOrderShareModal: React.FC<SplitOrderShareModalProps> = ({
    isOpen,
    onClose,
    shareLink,
    orderNumber,
    splitCount,
    totalAmount
}) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Split Cake Order',
                    text: `Help me fund this cake order! Order #${orderNumber}`,
                    url: shareLink,
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            // Fallback or just rely on copy
            handleCopy();
        }
    };

    const perPerson = totalAmount / splitCount;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4">
                        <Share2 className="text-white" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">Order Created!</h2>
                    <p className="text-purple-100">Order #{orderNumber}</p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-slate-600">
                            Your split order has been created. Share this link with your friends to collect payments.
                        </p>
                        <div className="inline-block bg-purple-50 px-4 py-2 rounded-lg border border-purple-100">
                            <span className="text-purple-800 font-semibold">{formatCurrency(perPerson)}</span>
                            <span className="text-purple-600 text-sm"> / person</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                            Share Link
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={shareLink}
                                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-600 text-sm focus:outline-none"
                            />
                            <button
                                onClick={handleCopy}
                                className={`p-2 rounded-lg border transition-all ${copied
                                        ? 'bg-green-50 border-green-200 text-green-600'
                                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                                    }`}
                                title="Copy Link"
                            >
                                {copied ? <Check size={20} /> : <Copy size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleShare}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                        >
                            <Share2 size={18} />
                            <span>Share</span>
                        </button>
                        <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl font-medium transition-colors"
                        >
                            <ExternalLink size={18} />
                            <span>Messenger</span>
                        </a>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium transition-colors"
                    >
                        Close and view order
                    </button>
                </div>
            </div>
        </div>
    );
};
