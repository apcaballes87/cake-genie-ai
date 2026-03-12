'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useAnonymousAuth(enabled = true) {
    const supabase = createClient();
    const initializingRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;
        if (initializingRef.current) return;
        initializingRef.current = true;

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    await supabase.auth.signInAnonymously();
                }
            } catch (error) {
                // Error initializing anonymous session silently handled
            }
        };

        initializeAuth();
    }, [enabled, supabase]);
}
