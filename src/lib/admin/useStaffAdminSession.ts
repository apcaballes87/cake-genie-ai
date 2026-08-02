'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to verify staff access.';
}

export function useStaffAdminSession() {
  const supabase = useMemo(() => createClient(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error('Your staff session has expired. Sign in again.');
    }
    return data.session.access_token;
  }, [supabase]);

  const staffFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await getAccessToken()}`);
    return fetch(input, { ...init, credentials: 'include', headers });
  }, [getAccessToken]);

  const verifySession = useCallback(async () => {
    try {
      const response = await staffFetch('/api/admin/ai-diagnostics');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'This account is not authorized for admin tools.');
      }
      setAuthError(null);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setAuthError(getErrorMessage(error));
      setIsAuthenticated(false);
      return false;
    }
  }, [staffFetch]);

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && active) setIsAuthenticated(false);
    });
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && active) await verifySession();
      if (active) setIsBooting(false);
    })();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, verifySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsBooting(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setAuthError(error.message);
      setIsBooting(false);
      return false;
    }
    const authorized = await verifySession();
    setIsBooting(false);
    return authorized;
  }, [supabase, verifySession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  }, [supabase]);

  return {
    authError,
    isAuthenticated,
    isBooting,
    signIn,
    signOut,
    staffFetch,
  };
}
