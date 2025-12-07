'use client';
import React, { useState, useEffect } from 'react';
import { X, Users, MessageSquare, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface SplitWithFriendsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (splitCount: number, splitMessage: string) => void;
    totalAmount: number;
    isLoading: boolean;
}

export const SplitWithFriendsModal: React.FC<SplitWithFriendsModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    totalAmount,
    isLoading
}) => {
    const [splitCount, setSplitCount] = useState(2);
    const [splitMessage, setSplitMessage] = useState("Hey guys! Let's chip in for this cake! 🎂");
    const [perPersonAmount, setPerPersonAmount] = useState(0);

    useEffect(() => {
        if (splitCount > 0) {
            setPerPersonAmount(totalAmount / splitCount);
        }
    }, [splitCount, totalAmount]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(splitCount, splitMessage);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="flex justify-between items-center p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-100 rounded-full text-purple-600">
                            <Users size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Split with Friends</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-purple-700">Total Amount</span>
                            <span className="text-lg font-bold text-purple-900">{formatCurrency(totalAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-purple-200">
                            <span className="text-sm font-medium text-purple-700">Per Person</span>
                            <span className="text-xl font-bold text-purple-600">{formatCurrency(perPersonAmount)}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                How many people are splitting? <span className="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <Users size={18} />
                                </div>
                                <input
                                    type="number"
                                    min="2"
                                    max="50"
                                    value={splitCount}
                                    onChange={(e) => setSplitCount(parseInt(e.target.value) || 2)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Suggested: {formatCurrency(perPersonAmount)} per person
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Message to friends
                            </label>
                            <div className="relative">
                                <MessageSquare className="absolute left-3 top-3 text-slate-400" size={18} />
                                <textarea
                                    value={splitMessage}
                                    onChange={(e) => setSplitMessage(e.target.value)}
                                    rows={3}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all resize-none"
                                    placeholder="Add a message..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Calculator size={20} />
                                    <span>Place Order & Get Share Link</span>
                                </>
                            )}
                        </button>
                        <p className="text-xs text-center text-slate-500 mt-3">
                            The order will be confirmed once fully funded.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};
