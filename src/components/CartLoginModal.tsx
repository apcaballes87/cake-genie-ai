'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/lib/utils/toast';
import { Loader2 } from '@/components/icons';

interface CartLoginModalProps {
    initialEmail: string;
    onClose: () => void;
    onSignedIn: () => void;
}

function GoogleIcon() {
    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

export default function CartLoginModal({ initialEmail, onClose, onSignedIn }: CartLoginModalProps) {
    const { signIn, signInWithGoogle } = useAuth();
    const emailInputRef = useRef<HTMLInputElement>(null);
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const previousActiveElement = document.activeElement as HTMLElement | null;

        document.body.style.overflow = 'hidden';
        emailInputRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isLoading && !isGoogleLoading) onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previousActiveElement?.focus();
        };
    }, [isGoogleLoading, isLoading, onClose]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!email || !password) {
            showError('Please enter both your email and password.');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await signIn(email.trim(), password);
            if (error) {
                if (error.message?.includes('Invalid login credentials')) {
                    showError('Invalid email or password.');
                } else {
                    showError(error.message || 'Failed to sign in.');
                }
                return;
            }

            showSuccess('Welcome back! Your cart is ready.');
            onSignedIn();
        } catch (error: unknown) {
            showError(error instanceof Error ? error.message : 'An error occurred during sign in.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        try {
            const { error } = await signInWithGoogle('/cart');
            if (error) showError(error.message || 'Failed to sign in with Google.');
        } catch {
            showError('Failed to sign in with Google.');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const isBusy = isLoading || isGoogleLoading;

    return (
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm animate-fade-in"
            onClick={() => { if (!isBusy) onClose(); }}
            role="presentation"
        >
            <div
                className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-2xl sm:p-8"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cart-login-title"
                aria-describedby="cart-login-description"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isBusy}
                    className="absolute right-3 top-3 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Close sign in"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="mb-6 pr-8">
                    <h2 id="cart-login-title" className="text-2xl font-bold text-slate-900 sm:text-3xl">
                        Welcome <span className="text-purple-400">Back</span>
                    </h2>
                    <p id="cart-login-description" className="mt-2 text-sm text-slate-600">
                        Sign in to continue placing your order. Your cart will stay right here.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="cart-login-email" className="mb-2 block text-sm font-medium text-slate-700">
                            Email Address
                        </label>
                        <input
                            ref={emailInputRef}
                            id="cart-login-email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 transition-all focus:border-transparent focus:ring-2 focus:ring-purple-500"
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                            disabled={isBusy}
                        />
                    </div>

                    <div>
                        <label htmlFor="cart-login-password" className="mb-2 block text-sm font-medium text-slate-700">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="cart-login-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 transition-all focus:border-transparent focus:ring-2 focus:ring-purple-500"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                                disabled={isBusy}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((visible) => !visible)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                tabIndex={-1}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end text-sm">
                        <a href="/forgot-password?redirect=%2Fcart" className="font-medium text-purple-600 hover:text-purple-700">
                            Forgot password?
                        </a>
                    </div>

                    <button
                        type="submit"
                        disabled={isBusy}
                        className="genie-btn-primary flex w-full items-center justify-center rounded-lg px-6 py-3 font-semibold shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="relative my-6 flex items-center">
                    <div className="grow border-t border-slate-300" />
                    <span className="mx-4 shrink-0 text-sm font-medium text-slate-400">OR</span>
                    <div className="grow border-t border-slate-300" />
                </div>

                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isBusy}
                    className="mb-5 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                </button>

                <p className="text-center text-sm text-slate-600">
                    Don&apos;t have an account?{' '}
                    <a href="/signup?redirect=%2Fcart" className="font-semibold text-purple-600 hover:text-purple-700">
                        Create one
                    </a>
                </p>
            </div>
        </div>
    );
}
