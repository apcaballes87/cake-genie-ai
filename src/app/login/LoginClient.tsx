'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { showSuccess, showError } from '@/lib/utils/toast'
import { Loader2 } from '@/components/icons'

export default function LoginClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { signIn, user, isLoading: authLoading } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Redirect if already logged in
    useEffect(() => {
        if (user && !user.is_anonymous) {
            const redirect = searchParams.get('redirect') || '/'
            router.push(redirect)
        }
    }, [user, router, searchParams])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!email || !password) {
            showError('Please enter both email and password')
            return
        }

        setIsLoading(true)
        try {
            const { error } = await signIn(email, password)

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    showError('Invalid email or password')
                } else {
                    showError(error.message || 'Failed to sign in')
                }
            } else {
                showSuccess('Welcome back!')
                const redirect = searchParams.get('redirect') || '/'
                router.push(redirect)
            }
        } catch (error: any) {
            showError(error.message || 'An error occurred during sign in')
        } finally {
            setIsLoading(false)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
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
                        <h1 className="text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mb-2">
                            Welcome Back
                        </h1>
                        <p className="text-slate-600">Sign in to your Cake Genie account</p>
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
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                                    placeholder="••••••••"
                                    required
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-end text-sm">
                            <Link href="/forgot-password" className="text-purple-600 hover:text-purple-700 font-medium">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-linear-to-r from-pink-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative flex items-center my-8">
                        <div className="grow border-t border-slate-300"></div>
                        <span className="shrink-0 mx-4 text-slate-400 text-sm font-medium">OR</span>
                        <div className="grow border-t border-slate-300"></div>
                    </div>

                    {/* Sign Up Link */}
                    <div className="text-center">
                        <p className="text-slate-600 mb-4">
                            Don't have an account?{' '}
                            <Link href="/signup" className="text-purple-600 hover:text-purple-700 font-semibold">
                                Create one
                            </Link>
                        </p>
                        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
