'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/lib/utils/toast';

type PartyBudgetSignupModalProps = {
  onClose: () => void;
};

const calculatorRedirect = encodeURIComponent('/party-budget-calculator');

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function PartyBudgetSignupModal({ onClose }: PartyBudgetSignupModalProps) {
  const { signInWithGoogle } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isGoogleLoading) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGoogleLoading, onClose]);

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle('/party-budget-calculator');
      if (error) showError(error.message || 'Failed to continue with Google.');
    } catch {
      showError('Failed to continue with Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onClick={() => { if (!isGoogleLoading) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="party-budget-signup-title"
        aria-describedby="party-budget-signup-description"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isGoogleLoading}
          className="absolute right-3 top-3 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          aria-label="Close sign up"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-8">
          <h2 id="party-budget-signup-title" className="text-2xl font-bold text-slate-900">
            Save your <span className="text-purple-500">party budget</span>
          </h2>
          <p id="party-budget-signup-description" className="mt-2 text-sm text-slate-600">
            Create a free Genie.ph account to keep this budget and open it from My Account on any device.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={isGoogleLoading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        <Link
          href={`/signup?redirect=${calculatorRedirect}`}
          className="genie-btn-primary mt-3 flex w-full items-center justify-center rounded-lg px-6 py-3 font-semibold shadow-md"
        >
          Sign up with email
        </Link>

        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href={`/login?redirect=${calculatorRedirect}`} className="font-semibold text-purple-600 hover:text-purple-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
