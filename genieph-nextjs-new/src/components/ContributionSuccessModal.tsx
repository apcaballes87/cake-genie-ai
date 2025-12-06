'use client';
import React from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';

interface ContributionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  contributionAmount: number;
  discountCode: string;
  onStartDesigning: () => void;
}

export const ContributionSuccessModal: React.FC<ContributionSuccessModalProps> = ({
  isOpen,
  onClose,
  contributionAmount,
  discountCode,
  onStartDesigning,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-scale-in">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">
            Thank You! 🎉
          </h2>
          <p className="text-slate-600 mt-2">
            Your ₱{contributionAmount.toLocaleString()} contribution was successful!
          </p>

          <div className="mt-6 p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              <h3 className="font-bold text-pink-800">Here's ₱100 OFF Your First Cake!</h3>
            </div>
            <div className="my-3 py-2 px-4 bg-white border-2 border-dashed border-purple-400 rounded-lg text-purple-700 font-mono text-lg font-bold">
              {discountCode}
            </div>
            <p className="text-xs text-slate-500">
              Valid for 30 days on orders over ₱500
            </p>
          </div>

          <p className="text-sm text-slate-600 mt-6">
            ✨ You can design your own AI-powered custom cakes too!
          </p>

          <div className="mt-6 space-y-3">
            <button
              onClick={onStartDesigning}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
            >
              Start Designing Your Cake
            </button>
            <button
              onClick={onClose}
              className="w-full text-center bg-transparent text-slate-600 font-bold py-2 px-4 rounded-xl hover:bg-slate-100 transition-all text-sm"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
    </>
  );
};