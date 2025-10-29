// hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (initStartedRef.current) {
      console.log('🔒 Auth initialization already started, skipping...');
      return;
    }

    initStartedRef.current = true;

    // Set up auth state listener immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('🔄 Auth state changed in useAuth:', _event, session?.user?.id);
        setUser(session?.user ?? null);
      }
    );

    // Get initial session in background without blocking
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Initial session check result:', { hasSession: !!session, userId: session?.user?.id });
      setUser(session?.user ?? null);
    }).catch(error => {
      console.error('Background session check failed:', error);
    });

    // Clean up subscription
    return () => {
      console.log('🧹 Cleaning up auth subscription');
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (
    credentials: { email: string; password: string; },
    metadata?: { first_name?: string, last_name?: string }
  ) => {
    // Add timeout for sign up
    return new Promise<any>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sign up timeout - took longer than 10 seconds'));
      }, 10000); // 10 second timeout
      
      try {
        const result = await supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: {
                data: metadata
            }
        });
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }, []);

  const signIn = useCallback(async (credentials: { email: string; password: string; }) => {
    // Add timeout for sign in
    return new Promise<any>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sign in timeout - took longer than 10 seconds'));
      }, 10000); // 10 second timeout
      
      try {
        const result = await supabase.auth.signInWithPassword(credentials);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }, []);

  const signOut = useCallback(async () => {
    // Add timeout for sign out
    return new Promise<any>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sign out timeout - took longer than 10 seconds'));
      }, 10000); // 10 second timeout
      
      try {
        const result = await supabase.auth.signOut();
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
  };
};