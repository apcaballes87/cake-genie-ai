'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { showSuccess, showError } from '@/lib/utils/toast'
import { Loader2 } from '@/components/icons'

export default function ForgotPasswordClient() {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isEmailSent, setIsEmailSent] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!email) {
            showError('Please enter your email address')
            return
        }

        setIsLoading(true)
        try {
            const supabase = getSupabaseClient()

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/set-password`,
            })

            if (error) {
                showError(error.message || 'Failed to send reset email')
            } else {
                setIsEmailSent(true)
                showSuccess('Password reset email sent! Check your inbox.')
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An error occurred'
            showError(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    if (isEmailSent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50 px-4 py-12">
                <div className="w-full max-w-md">
                    <div className="relative bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
                        {/* Success Icon */}
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold text-slate-800 mb-4">
                            Check Your Email
                        </h1>
                        <p className="text-slate-600 mb-6">
                            We've sent a password reset link to <strong>{email}</strong>.
                            Click the link in the email to set a new password.
                        </p>

                        <div className="space-y-4">
                            <button
                                onClick={() => setIsEmailSent(false)}
                                className="text-purple-600 hover:text-purple-700 font-medium"
                            >
                                Didn't receive the email? Try again
                            </button>

                            <div>
                                <Link
                                    href="/login"
                                    className="text-sm text-slate-500 hover:text-slate-700"
                                >
                                    ← Back to Login
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50 px-4 py-12">
            <div className="w-full max-w-md">
                <div className="relative bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 p-8">
                    {/* Close Button */}
                    <Link
                        href="/"
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
                        aria-label="Back to Home"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </Link>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mb-2">
                            Forgot Password?
                        </h1>
                        <p className="text-slate-600">
                            No worries! Enter your email and we'll send you a reset link.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="you@example.com"
                                required
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-linear-to-r from-pink-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>
                    </form>

                    {/* Back to Login */}
                    <div className="text-center mt-8">
                        <Link
                            href="/login"
                            className="text-purple-600 hover:text-purple-700 font-medium inline-flex items-center"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
