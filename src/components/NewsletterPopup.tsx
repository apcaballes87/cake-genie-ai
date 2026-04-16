'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { trackSignUp } from '@/lib/analytics';
import { X, Eye, EyeOff } from 'lucide-react';

/** Key used to suppress the popup after it has been dismissed or completed. */
const SEEN_KEY = 'hasSeenNewsletterPopup';
/** Key used to resume the discount flow after a Google OAuth redirect. */
const PENDING_KEY = 'pendingSignupDiscount';

export default function NewsletterPopup() {
  const { user, isAuthenticated, isLoading, signUp, signInWithGoogle } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [discountCode, setDiscountCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Prevent the OAuth-return effect running more than once
  const oauthHandledRef = useRef(false);

  // ── Effect 1: Resume the discount flow if user just returned from Google OAuth ──
  useEffect(() => {
    if (isLoading) return;
    if (oauthHandledRef.current) return;

    const pending = localStorage.getItem(PENDING_KEY);
    if (pending === 'popup' && isAuthenticated && user && !user.is_anonymous) {
      oauthHandledRef.current = true;
      localStorage.removeItem(PENDING_KEY);
      setIsOpen(true);
      generateDiscountForCurrentUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user]);

  // ── Effect 2: Show popup after 25 s or 40 % scroll (only for unauthenticated visitors) ──
  useEffect(() => {
    if (isLoading) return;                                      // wait for auth
    if (isAuthenticated) return;                                // already logged in
    if (localStorage.getItem(SEEN_KEY)) return;                 // already dismissed

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
  }, [isLoading, isAuthenticated]);

  const closePopup = () => {
    setIsOpen(false);
    localStorage.setItem(SEEN_KEY, 'true');
  };

  /** Calls /api/signup-discount for the currently authenticated user. */
  const generateDiscountForCurrentUser = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/signup-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'popup' }),
      });
      const data = await res.json();
      if (data.success && data.code) {
        setDiscountCode(data.code);
        setStatus('success');
        localStorage.setItem(SEEN_KEY, 'true');
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to generate discount code. Please contact support.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('An unexpected error occurred.');
    }
  };

  // ── Email / password sign-up ──
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!firstName.trim()) {
      setErrorMessage('Please enter your first name.');
      setStatus('error');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      setStatus('error');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    const { data, error } = await signUp(email, password, { first_name: firstName.trim() });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Sign up failed. Please try again.');
      return;
    }

    if (!data?.session) {
      // Email confirmation required — show a holding message
      setStatus('success');
      setDiscountCode('');          // no code yet; shown after confirmation
      localStorage.setItem(SEEN_KEY, 'true');
      trackSignUp('email', 'signup_popup');
      return;
    }

    // Immediately authenticated (email confirmation disabled)
    trackSignUp('email', 'signup_popup');
    await generateDiscountForCurrentUser();
  };

  // ── Google OAuth sign-up ──
  const handleGoogleSignup = async () => {
    // Store a flag so we re-open the popup and generate the code on return
    localStorage.setItem(PENDING_KEY, 'popup');
    await signInWithGoogle();
    // Page will redirect to Google — execution stops here
  };

  if (!isOpen) return null;

  return (
    <React.Fragment>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[69]" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden p-8">
          {/* Close button */}
          <button
            onClick={closePopup}
            className="absolute top-4 right-4 text-slate-400 p-2 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ── Success state ── */}
          {status === 'success' ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🎉</div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-3">
                {discountCode ? 'YOU\'RE ALL SET!' : 'ALMOST THERE!'}
              </h2>

              {discountCode ? (
                <>
                  <p className="text-base text-gray-600 mb-5">Here is your 20% off discount code:</p>
                  <div className="bg-purple-50 border-2 border-dashed border-purple-300 rounded-xl py-3 px-6 inline-block mb-6 shadow-sm">
                    <span className="text-2xl font-bold tracking-wider text-purple-700">{discountCode}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">Use this code at checkout to claim your discount.</p>
                </>
              ) : (
                <>
                  <p className="text-base text-gray-600 mb-5">
                    We sent a confirmation link to <strong>{email}</strong>.<br />
                    Confirm your email to activate your account — your 20% discount will be waiting for you at checkout.
                  </p>
                </>
              )}

              <button
                onClick={closePopup}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-md active:scale-[0.98] w-full"
              >
                CONTINUE SHOPPING
              </button>
            </div>

          ) : (
            /* ── Sign-up form ── */
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-[1.15] mb-2 tracking-tight text-center">
                CREATE AN ACCOUNT &amp; GET <span className="text-purple-600 italic">20% OFF</span> YOUR FIRST ORDER
              </h2>
              <p className="text-gray-500 mb-6 text-sm text-center leading-relaxed">
                Sign up for free to unlock your exclusive discount code.
              </p>

              {/* Google OAuth — primary CTA */}
              <button
                onClick={handleGoogleSignup}
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 mb-4"
              >
                {/* Google "G" logo */}
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Email / password form */}
              <form onSubmit={handleEmailSignup} className="space-y-3">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                  className="w-full border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-slate-50 text-gray-900 text-sm transition-shadow"
                  disabled={status === 'loading'}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  className="w-full border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-slate-50 text-gray-900 text-sm transition-shadow"
                  disabled={status === 'loading'}
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min. 6 characters)"
                    autoComplete="new-password"
                    className="w-full border border-slate-200 px-4 py-3 pr-11 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-slate-50 text-gray-900 text-sm transition-shadow"
                    disabled={status === 'loading'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {status === 'error' && errorMessage && (
                  <p className="text-red-500 text-sm font-medium">{errorMessage}</p>
                )}

                <div className="flex gap-2 sm:gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 whitespace-nowrap text-[12px] sm:text-sm"
                  >
                    {status === 'loading' ? 'SIGNING UP…' : 'SIGN UP & SAVE 20%'}
                  </button>
                  <button
                    type="button"
                    onClick={closePopup}
                    disabled={status === 'loading'}
                    className="flex-1 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 font-semibold py-3 px-2 rounded-xl transition-all active:scale-[0.98] whitespace-nowrap text-[12px] sm:text-sm"
                  >
                    NO THANKS
                  </button>
                </div>
              </form>

              <p className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
                By signing up you agree to our terms &amp; privacy policy. Already have an account?{' '}
                <button
                  onClick={closePopup}
                  className="underline hover:text-slate-600 transition-colors"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}
