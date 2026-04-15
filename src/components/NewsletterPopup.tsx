'use client';

import React, { useState, useEffect } from 'react';
import { subscribeToNewsletter } from '@/services/supabaseService';
import { trackSignUp } from '@/lib/analytics';
import { X } from 'lucide-react';

export default function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('hasSeenNewsletterPopup')) return;

    // Open on whichever happens first:
    //  - 25 seconds elapsed (down from 5s — less intrusive for cold traffic)
    //  - user scrolls past 40% of the page (already engaged → good moment)
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      setIsOpen(true);
    };

    const timer = setTimeout(open, 25_000);

    const onScroll = () => {
      const docEl = document.documentElement;
      const scrolled = window.scrollY + window.innerHeight;
      const total = docEl.scrollHeight;
      if (total > 0 && scrolled / total > 0.4) open();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const closePopup = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenNewsletterPopup', 'true');
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setErrorMessage('Please enter your email address.');
      setStatus('error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const success = await subscribeToNewsletter(email, 'popup');

      if (success) {
        setStatus('success');
        trackSignUp('email', 'newsletter_popup');
        localStorage.setItem('hasSeenNewsletterPopup', 'true');
      } else {
        setStatus('error');
        setErrorMessage('Failed to subscribe. Please try again later.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('An unexpected error occurred.');
    }
  };

  if (!isOpen) return null;

  return (
    <React.Fragment>
      {/* Backdrop blur */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-69" />
      <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden p-8">
          {/* Close Button */}
          <button
            onClick={closePopup}
            className="absolute top-4 right-4 text-slate-400 p-2 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {status === 'success' ? (
            <div className="text-center py-6">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-3">THANK YOU!</h2>
              <p className="text-base text-gray-600 mb-5">Here is your 20% off discount code:</p>
              <div className="bg-purple-50 border-2 border-dashed border-purple-300 rounded-xl py-3 px-6 inline-block mb-6 shadow-sm">
                <span className="text-2xl font-bold tracking-wider text-purple-700">NEW20</span>
              </div>
              <p className="text-sm text-gray-500 mb-6">Use this code at checkout to claim your discount.</p>
              <button
                onClick={closePopup}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-md active:scale-[0.98] w-full"
              >
                CONTINUE SHOPPING
              </button>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-[1.15] mb-3 tracking-tight">
                JOIN OUR MAILING LIST AND GET <br className="hidden sm:block" />
                <span className="text-purple-600 italic">20% OFF</span> YOUR FIRST PURCHASE
              </h2>
              <p className="text-gray-600 mb-6 text-sm sm:text-base leading-relaxed">
                Enter your email address below to get your discount code and join our mailing list.
              </p>

              <form onSubmit={handleSubscribe} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    className="w-full border border-slate-200 px-4 py-3.5 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-slate-50 text-gray-900 transition-shadow"
                    disabled={status === 'loading'}
                  />
                  {status === 'error' && (
                    <p className="text-red-500 text-sm mt-1.5 font-medium">{errorMessage}</p>
                  )}
                </div>

                <div className="flex gap-2 sm:gap-3 mt-5 w-full">
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="flex-1 bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 whitespace-nowrap text-[12px] sm:text-sm"
                  >
                    {status === 'loading' ? 'SIGNING UP...' : 'SIGN ME UP'}
                  </button>
                  <button
                    type="button"
                    onClick={closePopup}
                    className="flex-1 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 font-semibold py-3 px-2 rounded-xl transition-all active:scale-[0.98] whitespace-nowrap text-[12px] sm:text-sm"
                  >
                    NO THANKS
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}
