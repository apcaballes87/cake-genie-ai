'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function CheckEmailContent() {
    const searchParams = useSearchParams()
    const email = searchParams.get('email')

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50 px-4 py-12">
            <div className="w-full max-w-md">
                <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
                    {/* Email icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mb-3">
                        Check your email
                    </h1>

                    <p className="text-slate-600 mb-2">
                        We sent a verification link to:
                    </p>
                    {email && (
                        <p className="font-semibold text-slate-800 mb-4 break-all">{email}</p>
                    )}

                    <p className="text-slate-500 text-sm mb-8">
                        Click the link in the email to verify your account. Once verified, you can sign in.
                        <br />
                        <span className="text-slate-400 text-xs mt-1 block">Don&apos;t see it? Check your spam folder.</span>
                    </p>

                    <Link
                        href="/login"
                        className="w-full inline-block bg-linear-to-r from-pink-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-center"
                    >
                        Go to Sign In
                    </Link>

                    <p className="mt-4 text-sm text-slate-500">
                        Wrong email?{' '}
                        <Link href="/signup" className="text-purple-600 hover:text-purple-700 font-medium">
                            Sign up again
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default function CheckEmailPage() {
    return (
        <Suspense>
            <CheckEmailContent />
        </Suspense>
    )
}
