'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextType {
    user: User | null
    session: Session | null
    isLoading: boolean
    loading: boolean // Backwards compatibility alias for isLoading
    isAuthenticated: boolean
    signIn: (email: string, password: string) => Promise<{ error: any }>
    signUp: (email: string, password: string, metadata?: { first_name?: string, last_name?: string }) => Promise<{ data: any, error: any }>
    signOut: () => Promise<{ error: any }>
    signInAnonymously: () => Promise<{ error: any }>
    signInWithGoogle: (redirectTo?: string) => Promise<{ data: any, error: any }>
}

const AuthContext = createContext<AuthContextType | null>(null)

import { useAnonymousAuth } from '@/hooks/useAnonymousAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const shouldDeferAnonymousAuth = pathname === '/'

    useAnonymousAuth(!shouldDeferAnonymousAuth)
    const supabase = createClient()
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
    }, [supabase])

    const signUp = useCallback(async (
        email: string,
        password: string,
        metadata?: { first_name?: string, last_name?: string }
    ) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        })
        return { data, error }
    }, [supabase])

    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut()
        return { error }
    }, [supabase])

    const signInAnonymously = useCallback(async () => {
        const { error } = await supabase.auth.signInAnonymously()
        return { error }
    }, [supabase])

    const signInWithGoogle = useCallback(async (redirectTo?: string) => {
        const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
        const callbackUrl = new URL('/auth/callback', origin)
        if (redirectTo) callbackUrl.searchParams.set('next', redirectTo)

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: callbackUrl.toString(),
            },
        })
        return { data, error }
    }, [supabase])

    const isAuthenticated = !!user && !user.is_anonymous

    return (
        <AuthContext.Provider value={{
            user,
            session,
            isLoading,
            loading: isLoading, // Backwards compatibility alias
            isAuthenticated,
            signIn,
            signUp,
            signOut,
            signInAnonymously,
            signInWithGoogle,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
