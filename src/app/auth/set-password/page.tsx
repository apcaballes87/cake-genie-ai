'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { showSuccess, showError } from '../../../lib/utils/toast';
import { Loader2 } from '../../../components/icons';

export default function SetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [email, setEmail] = useState('');

    useEffect(() => {
        const verifyEmail = async () => {
            const supabase = getSupabaseClient();

            const debugLog = (msg: string, data?: any) => {
                console.log(msg, data);
                // Store in localStorage so we can see it even after redirect
                const logs = JSON.parse(localStorage.getItem('setPasswordDebug') || '[]');
                logs.push({ time: new Date().toISOString(), msg, data });
                localStorage.setItem('setPasswordDebug', JSON.stringify(logs));
            };

            debugLog('[SetPassword] Starting verification...');
            debugLog('[SetPassword] Current URL:', window.location.href);
            debugLog('[SetPassword] Hash:', window.location.hash);

            // Extract the access_token from the URL hash to verify the email
            const hashParams = new URLSearchParams(window.location.hash.split('#')[2] || '');
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            debugLog('[SetPassword] Access token from URL:', accessToken ? 'present' : 'missing');
            debugLog('[SetPassword] Refresh token from URL:', refreshToken ? 'present' : 'missing');

            // Decode the JWT to get the email (JWT format: header.payload.signature)
            let tokenEmail: string | null = null;
            if (accessToken) {
                try {
                    const payload = JSON.parse(atob(accessToken.split('.')[1]));
                    tokenEmail = payload.email;
                    debugLog('[SetPassword] Email from token:', tokenEmail);
                } catch (e) {
                    debugLog('[SetPassword] Failed to decode token:', e);
                }
            }

            // Manually set the session from the recovery token
            // This ensures Supabase uses the correct session instead of an existing one
            if (accessToken && refreshToken) {
                debugLog('[SetPassword] Manually setting session from recovery token...');
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                debugLog('[SetPassword] Set session result:', { data, error });
            }

            // Wait a bit for the session to be fully established
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check session after recovery token processing
            const { data: { session } } = await supabase.auth.getSession();
            debugLog('[SetPassword] Session after recovery:', session);

            // Check if user just confirmed their email
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            debugLog('[SetPassword] First getUser attempt:', { user, userError });
            debugLog('[SetPassword] User email value:', user?.email);
            debugLog('[SetPassword] User email check:', { hasUser: !!user, hasEmail: !!user?.email, isAnonymous: user?.is_anonymous });

            // SECURITY: Verify the session email matches the token email
            if (user && user.email && tokenEmail && user.email !== tokenEmail) {
                debugLog('[SetPassword] SECURITY: Email mismatch!', { userEmail: user.email, tokenEmail });
                showError('Security error: Session mismatch. Please try again.');
                await supabase.auth.signOut();
                setIsVerifying(false);
                return;
            }

            // Check if we have a valid user with an email (not anonymous)
            if (user && user.email && !user.is_anonymous) {
                debugLog('[SetPassword] User verified successfully:', user.email);
                setEmail(user.email);
                setIsVerifying(false);
            } else if (user?.is_anonymous) {
                // If we got an anonymous user, sign out and retry
                debugLog('[SetPassword] Got anonymous user, signing out and retrying...');
                await supabase.auth.signOut();
                await new Promise(resolve => setTimeout(resolve, 2000));

                const { data: { user: retryUser }, error: retryError } = await supabase.auth.getUser();
                debugLog('[SetPassword] Retry getUser attempt:', { retryUser, retryError });
                debugLog('[SetPassword] Retry user email value:', retryUser?.email);

                if (retryUser && retryUser.email && !retryUser.is_anonymous) {
                    // SECURITY: Verify retry email matches token
                    if (tokenEmail && retryUser.email !== tokenEmail) {
                        debugLog('[SetPassword] SECURITY: Retry email mismatch!', { userEmail: retryUser.email, tokenEmail });
                        showError('Security error: Session mismatch. Please try again.');
                        setIsVerifying(false);
                        return;
                    }
                    debugLog('[SetPassword] User verified on retry:', retryUser.email);
                    setEmail(retryUser.email);
                    setIsVerifying(false);
                } else {
                    debugLog('[SetPassword] Verification failed after retry');
                    debugLog('[SetPassword] Final failure reason:', { retryUser: !!retryUser, email: retryUser?.email, isAnonymous: retryUser?.is_anonymous });
                    showError('Invalid or expired link. Please try again.');
                    setIsVerifying(false);
                }
            } else {
                debugLog('[SetPassword] First attempt failed, retrying...');
                debugLog('[SetPassword] Failure reason:', { user: !!user, email: user?.email });
                // Retry once more after another delay
                await new Promise(resolve => setTimeout(resolve, 2000));

                const { data: { session: retrySession } } = await supabase.auth.getSession();
                debugLog('[SetPassword] Retry session:', retrySession);

                const { data: { user: retryUser }, error: retryError } = await supabase.auth.getUser();
                debugLog('[SetPassword] Retry getUser attempt:', { retryUser, retryError });
                debugLog('[SetPassword] Retry user email value:', retryUser?.email);
                debugLog('[SetPassword] Retry user email check:', { hasUser: !!retryUser, hasEmail: !!retryUser?.email });

                if (retryUser && retryUser.email && !retryUser.is_anonymous) {
                    // SECURITY: Verify retry email matches token
                    if (tokenEmail && retryUser.email !== tokenEmail) {
                        debugLog('[SetPassword] SECURITY: Retry email mismatch!', { userEmail: retryUser.email, tokenEmail });
                        showError('Security error: Session mismatch. Please try again.');
                        setIsVerifying(false);
                        return;
                    }
                    debugLog('[SetPassword] User verified on retry:', retryUser.email);
                    setEmail(retryUser.email);
                    setIsVerifying(false);
                } else {
                    debugLog('[SetPassword] Verification failed after retry');
                    debugLog('[SetPassword] Final failure reason:', { retryUser: !!retryUser, email: retryUser?.email });
                    showError('Invalid or expired link. Please try again.');
                    setIsVerifying(false);
                }
            }
        };

        verifyEmail();
    }, []);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const supabase = getSupabaseClient();

            // Set the password for the user
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            showSuccess('Password set successfully! You can now log in anytime.');

            // Redirect to homepage after 2 seconds
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);

        } catch (error: any) {
            console.error('Error setting password:', error);
            showError(error.message || 'Failed to set password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isVerifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
                <div className="text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-pink-500 mx-auto mb-4" />
                    <p className="text-slate-600">Verifying your email...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Set Your Password</h1>
                    <p className="text-slate-600">
                        Welcome! Your email <span className="font-semibold text-pink-600">{email}</span> has been confirmed.
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                        Set a password to access your account anytime.
                    </p>
                </div>

                <form onSubmit={handleSetPassword} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                            New Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            placeholder="Enter password (min. 6 characters)"
                            required
                            minLength={6}
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                            placeholder="Confirm your password"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold py-3 rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                Setting Password...
                            </>
                        ) : (
                            'Set Password & Activate Account'
                        )}
                    </button>
                </form>

                <p className="text-xs text-slate-500 text-center mt-6">
                    After setting your password, you'll be able to log in and track your orders.
                </p>
            </div>
        </div>
    );
}
