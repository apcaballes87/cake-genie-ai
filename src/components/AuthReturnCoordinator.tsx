'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCurrentRelativeUrl,
  readPendingSignupDiscount,
} from '@/lib/auth/signupDiscountReturnState';
import { replaceBrowserLocation } from '@/lib/auth/browserRedirect';
import {
  clearPendingAuthReturn,
  readPendingAuthReturn,
} from '@/lib/auth/pendingAuthReturn';

/**
 * Recovers a customizer OAuth return if the auth callback falls back to the
 * landing page. The bubble remains responsible for applying the price-aware
 * discount once the target customizer route is mounted.
 */
export default function AuthReturnCoordinator() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();
  const redirectStartedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || user.is_anonymous) return;
    if (redirectStartedRef.current) return;

    const pending = readPendingSignupDiscount();
    const pendingAuthReturn = readPendingAuthReturn();
    const returnTo = pendingAuthReturn || (pending?.source === 'bubble' ? pending.returnTo : null);
    if (!returnTo) return;

    const currentUrl = getCurrentRelativeUrl(window.location);
    if (currentUrl === returnTo) {
      clearPendingAuthReturn();
      return;
    }

    redirectStartedRef.current = true;
    replaceBrowserLocation(returnTo);
  }, [isAuthenticated, isLoading, pathname, user]);

  return null;
}
