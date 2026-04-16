'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { validateDiscountCode } from '@/services/discountService';
import { Sparkles, Check, ChevronRight, X, Eye, EyeOff, Tag } from 'lucide-react';
import { showSuccess, showError } from '@/lib/utils/toast';

/** localStorage key used to resume the discount flow after a Google OAuth redirect. */
const PENDING_KEY = 'pendingSignupDiscount';

interface DiscountOfferBubbleProps {
  basePrice: number;
  onApplied?: () => void;
  isShiftedUp?: boolean;
}

export const DiscountOfferBubble: React.FC<DiscountOfferBubbleProps> = ({
  basePrice,
  onApplied,
  isShiftedUp,
}) => {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, signUp, signInWithGoogle } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [hasApplied, setHasApplied] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [appliedCode, setAppliedCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Prevent the OAuth-return effect running more than once per mount
  const oauthHandledRef = useRef(false);

  // ── Restore already-applied discount from localStorage ──
  useEffect(() => {
    const storedCode = localStorage.getItem('cart_discount_code');
    if (storedCode) {
      setAppliedCode(storedCode);
      setHasApplied(true);
    }
  }, []);

  // ── Resume the discount flow if user just returned from Google OAuth ──
  useEffect(() => {
    if (isLoading) return;
    if (oauthHandledRef.current) return;

    const pending = localStorage.getItem(PENDING_KEY);
    if (pending === 'bubble' && isAuthenticated && user && !user.is_anonymous) {
      oauthHandledRef.current = true;
      localStorage.removeItem(PENDING_KEY);
      applyDiscountForCurrentUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user]);

  const discountedPrice = basePrice * 0.8;
  const savings = basePrice - discountedPrice;

  /** Calls /api/signup-discount then validates and stores the code in localStorage. */
  const applyDiscountForCurrentUser = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/signup-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'customizing_bubble' }),
      });
      const data = await res.json();

      if (!data.success || !data.code) {
        showError(data.error || 'Could not generate discount. Please try again.');
        setStatus('idle');
        return;
      }

      const code: string = data.code;

      // Validate to get codeId so CartClient can use it at checkout
      const validationResult = await validateDiscountCode(code, basePrice);

      localStorage.setItem('cart_discount_code', code);
      localStorage.setItem('cart_applied_discount', JSON.stringify(validationResult));

      setAppliedCode(code);
      showSuccess(`20% Discount Unlocked! Code ${code} applied.`);
      setStatus('success');
      setHasApplied(true);
      if (onApplied) onApplied();
      setTimeout(() => setIsExpanded(false), 2000);
    } catch (err) {
      console.error('Error generating discount for user:', err);
      showError('Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  // ── Google OAuth ──
  const handleGoogleSignup = async () => {
    localStorage.setItem(PENDING_KEY, 'bubble');
    // Pass current path so the callback redirects back here
    await signInWithGoogle(pathname);
    // Page will redirect to Google — execution stops here
  };

  // ── Email / password sign-up ──
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setErrorMessage('Enter a valid email.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password min. 6 characters.');
      return;
    }

    setStatus('loading');
    const { data, error } = await signUp(email, password);

    if (error) {
      setErrorMessage(error.message || 'Sign up failed.');
      setStatus('idle');
      return;
    }

    if (!data?.session) {
      // Email confirmation required — can't generate code until confirmed
      showSuccess('Check your email to confirm your account, then return here for your discount!');
      setStatus('idle');
      setIsExpanded(false);
      return;
    }

    // Immediately authenticated
    await applyDiscountForCurrentUser();
  };

  // Don't render if discount is already applied (and bubble is collapsed) or hidden
  if (!isVisible || (hasApplied && !isExpanded)) return null;

  return (
    <div className="relative">
      {/* ── Collapsed teaser bubble ── */}
      {!isExpanded ? (
        <div className={`absolute bottom-full -left-2 ${isShiftedUp ? 'mb-[76px]' : 'mb-[17px]'} animate-bounce-subtle`}>
          <div className="relative bg-purple-100 text-purple-900 px-4 py-3 rounded-2xl shadow-xl border border-purple-200 min-w-[200px] flex flex-col gap-1">
            {/* Close */}
            <button
              onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
              className="absolute -top-2 -right-2 p-1 bg-white hover:bg-gray-50 border border-purple-200 text-purple-600 rounded-full shadow-md transition-all active:scale-95 z-50"
              aria-label="Close discount offer"
            >
              <X className="w-3 h-3" />
            </button>
            {/* Arrow pointing down */}
            <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-purple-100 border-r border-b border-purple-200 rotate-45" />

            <div className="text-[11px] font-extrabold flex items-center gap-1 text-purple-700 uppercase tracking-tight">
              <Sparkles className="w-3 h-3 fill-purple-600" />
              SIGN UP &amp; GET 20% OFF!!
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
        /* ── Expanded form panel ── */
        <div className={`absolute bottom-full -left-2 ${isShiftedUp ? 'mb-[110px]' : 'mb-[30px]'} w-72 bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300 z-50`}>
          {/* Header */}
          <div className="bg-purple-50 p-4 border-b border-purple-100">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-purple-600" />
                {isAuthenticated ? 'CLAIM YOUR DISCOUNT' : 'SIGN UP TO SAVE'}
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {isAuthenticated
                ? `Apply your exclusive 20% discount and save ₱${savings.toLocaleString()} on this order.`
                : `Sign up to get a unique 20% off code and save ₱${savings.toLocaleString()} immediately.`}
            </p>
          </div>

          <div className="p-4">
            {/* ── Success state ── */}
            {status === 'success' ? (
              <div className="text-center py-2 animate-in zoom-in">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 text-green-600">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-gray-900">Discount Unlocked!</p>
                <p className="text-[10px] text-gray-500">{appliedCode} applied to your cart.</p>
              </div>

            ) : isAuthenticated ? (
              /* ── Already logged in — one-click claim ── */
              <button
                onClick={applyDiscountForCurrentUser}
                disabled={status === 'loading'}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {status === 'loading' ? 'APPLYING…' : (
                  <>
                    APPLY 20% DISCOUNT
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

            ) : (
              /* ── Not authenticated — sign-up form ── */
              <div className="space-y-3">
                {/* Google OAuth — primary CTA */}
                <button
                  onClick={handleGoogleSignup}
                  disabled={status === 'loading'}
                  className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3 rounded-xl text-xs transition-all shadow-sm active:scale-95 disabled:opacity-60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Email + password */}
                <form onSubmit={handleEmailSignup} className="space-y-2">
                  <input
                    autoFocus
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none transition-all"
                    disabled={status === 'loading'}
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min. 6 chars)"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none transition-all"
                      disabled={status === 'loading'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {errorMessage && (
                    <p className="text-red-500 text-[10px] font-medium">{errorMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    {status === 'loading' ? 'SIGNING UP…' : (
                      <>
                        GET MY 20% DISCOUNT
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
