// hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Initial check
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    checkUser();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (
    credentials: { email: string; password: string; },
    metadata?: { first_name?: string, last_name?: string }
  ) => {
    const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
            data: metadata
        }
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (credentials: { email: string; password: string; }) => {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
  };
};
