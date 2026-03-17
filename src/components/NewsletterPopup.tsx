'use client';

import React, { useState, useEffect } from 'react';
import { subscribeToNewsletter } from '@/services/supabaseService';
import { X } from 'lucide-react';

export default function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Check local storage to see if user has already seen/closed the popup
    const hasSeenPopup = localStorage.getItem('hasSeenNewsletterPopup');

    if (!hasSeenPopup) {
      // Trigger popup after 5 seconds
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
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

    // Basic email validation
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md bg-[#FFF5F5] rounded-lg shadow-xl overflow-hidden p-8">
        {/* Close Button */}
        <button
          onClick={closePopup}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {status === 'success' ? (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-[#2E3159] mb-4">THANK YOU!</h2>
            <p className="text-lg text-[#2E3159] mb-6">Here is your 20% off discount code:</p>
            <div className="bg-white border-2 border-dashed border-[#F39C8E] rounded-md py-3 px-6 inline-block mb-6">
              <span className="text-2xl font-bold tracking-wider text-[#F39C8E]">NEW20</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">Use this code at checkout to claim your discount.</p>
            <button
              onClick={closePopup}
              className="bg-[#2E3159] hover:bg-[#1f213d] text-white font-semibold py-3 px-8 rounded transition-colors w-full"
            >
              CONTINUE SHOPPING
            </button>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2E3159] leading-tight mb-2">
              JOIN OUR MAILING LIST AND GET <br className="hidden sm:block" />
              20% OFF YOUR FIRST PURCHASE
            </h2>
            <p className="text-[#2E3159] mb-6 text-sm sm:text-base">
              Enter your email address below to get your discount code and join our mailing list.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full border border-[#F39C8E] px-4 py-3 rounded text-center focus:outline-none focus:ring-2 focus:ring-[#F39C8E] bg-white text-[#2E3159]"
                  disabled={status === 'loading'}
                />
                {status === 'error' && (
                  <p className="text-red-500 text-sm mt-1">{errorMessage}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="flex-1 bg-[#F39C8E] hover:bg-[#e08b7d] text-white font-semibold py-3 px-4 rounded transition-colors disabled:opacity-70 whitespace-nowrap text-sm sm:text-base"
                >
                  {status === 'loading' ? 'SIGNING UP...' : 'LOVE IT, SIGN ME UP'}
                </button>
                <button
                  type="button"
                  onClick={closePopup}
                  className="flex-1 bg-[#717684] hover:bg-[#5a5e6a] text-white font-semibold py-3 px-4 rounded transition-colors whitespace-nowrap text-sm sm:text-base"
                >
                  NO, I HATE SAVING MONEY
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
