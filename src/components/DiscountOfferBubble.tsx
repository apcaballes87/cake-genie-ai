'use client';

import React, { useState, useEffect } from 'react';
import { subscribeToNewsletter } from '@/services/supabaseService';
import { validateDiscountCode } from '@/services/discountService';
import { Sparkles, Check, ChevronRight, X, Mail } from 'lucide-react';
import { showSuccess, showError } from '@/lib/utils/toast';

interface DiscountOfferBubbleProps {
  basePrice: number;
  onApplied?: () => void;
  isShiftedUp?: boolean;
}

export const DiscountOfferBubble: React.FC<DiscountOfferBubbleProps> = ({ basePrice, onApplied, isShiftedUp }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [hasApplied, setHasApplied] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [appliedCode, setAppliedCode] = useState('');

  useEffect(() => {
    // Check if a discount was already applied in this session
    const storedCode = localStorage.getItem('cart_discount_code');
    if (storedCode) {
      setAppliedCode(storedCode);
      setHasApplied(true);
    }
  }, []);

  const discountedPrice = basePrice * 0.8;
  const savings = basePrice - discountedPrice;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      showError('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    try {
      const code = await subscribeToNewsletter(email, 'customizing_bubble');
      if (!code) {
        showError('Subscription failed. Please try again.');
        setStatus('idle');
        return;
      }

      // Validate the real code to get the actual codeId for order creation
      const validationResult = await validateDiscountCode(code, basePrice);

      // Store the code and real validation result so CartClient picks them up correctly
      localStorage.setItem('cart_discount_code', code);
      localStorage.setItem('cart_applied_discount', JSON.stringify(validationResult));

      setAppliedCode(code);
      showSuccess(`20% Discount Unlocked! Code ${code} applied.`);
      setStatus('success');
      setHasApplied(true);
      if (onApplied) onApplied();
      setTimeout(() => setIsExpanded(false), 2000);
    } catch (err) {
      console.error('Error in discount bubble signup:', err);
      showError('Something went wrong.');
      setStatus('idle');
    }
  };

  if (!isVisible || (hasApplied && !isExpanded)) return null;

  return (
    <div className="relative">
      {!isExpanded ? (
        <div className={`absolute bottom-full -left-2 ${isShiftedUp ? 'mb-[76px]' : 'mb-[17px]'} animate-bounce-subtle`}>
          <div className="relative bg-purple-100 text-purple-900 px-4 py-3 rounded-2xl shadow-xl border border-purple-200 min-w-[200px] flex flex-col gap-1">
            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="absolute -top-2 -right-2 p-1 bg-white hover:bg-gray-50 border border-purple-200 text-purple-600 rounded-full shadow-md transition-all active:scale-95 z-50"
              aria-label="Close discount offer"
            >
              <X className="w-3 h-3" />
            </button>
            {/* Arrow */}
            <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-purple-100 border-r border-b border-purple-200 rotate-45"></div>

            <div className="text-[11px] font-extrabold flex items-center gap-1 text-purple-700 uppercase tracking-tight">
              <Sparkles className="w-3 h-3 fill-purple-600" />
              SIGN UP & GET 20% OFF!!
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-400 line-through font-medium">₱{basePrice.toLocaleString()}</span>
              <span className="text-sm text-purple-900 font-black">₱{discountedPrice.toLocaleString()}</span>

              <button
                onClick={() => setIsExpanded(true)}
                className="ml-auto bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black px-3 py-1 rounded-lg transition-all active:scale-90 shadow-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`absolute bottom-full -left-2 ${isShiftedUp ? 'mb-[110px]' : 'mb-[30px]'} w-72 bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300 z-50`}>
          <div className="bg-purple-50 p-4 border-b border-purple-100">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-purple-600" />
                SIGN UP TO SAVE
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Enter your email to get a unique 20% off code and save <b>₱{savings.toLocaleString()}</b> immediately.
            </p>
          </div>

          <div className="p-4">
            {status === 'success' ? (
              <div className="text-center py-2 animate-in zoom-in">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 text-green-600">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-gray-900">Discount Unlocked!</p>
                <p className="text-[10px] text-gray-500">{appliedCode} applied to your cart.</p>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none transition-all"
                    disabled={status === 'loading'}
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {status === 'loading' ? 'APPLYING...' : (
                    <>
                      GET DISCOUNT
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
