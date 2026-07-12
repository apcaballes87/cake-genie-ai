import { isValidRedirect } from '@/lib/utils/urlHelpers';

export const PENDING_SIGNUP_DISCOUNT_KEY = 'pendingSignupDiscount';
export const PENDING_SIGNUP_DISCOUNT_MAX_AGE_MS = 30 * 60 * 1000;

export type SignupDiscountSource = 'bubble' | 'popup';

export interface PendingSignupDiscountState {
  source: SignupDiscountSource;
  returnTo: string;
  createdAt: number;
}

export function getCurrentRelativeUrl(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
}

export function serializePendingSignupDiscount(
  state: PendingSignupDiscountState,
): string {
  return JSON.stringify(state);
}

export function parsePendingSignupDiscount(
  rawValue: string | null,
  now = Date.now(),
): PendingSignupDiscountState | null {
  if (!rawValue) return null;

  // Keep the older popup/bubble marker format readable for users who started
  // OAuth before this return-state contract was deployed.
  if (rawValue === 'popup' || rawValue === 'bubble') {
    return {
      source: rawValue,
      // Legacy bubble markers have no safe target. The bubble can still
      // complete the discount if the user returns to the same page, but the
      // global coordinator must not redirect them to an invented location.
      returnTo: rawValue === 'bubble' ? '' : '/',
      createdAt: now,
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PendingSignupDiscountState>;
    if (
      (parsed.source !== 'bubble' && parsed.source !== 'popup') ||
      typeof parsed.returnTo !== 'string' ||
      !isValidRedirect(parsed.returnTo) ||
      typeof parsed.createdAt !== 'number' ||
      !Number.isFinite(parsed.createdAt)
    ) {
      return null;
    }

    if (now - parsed.createdAt < 0 || now - parsed.createdAt > PENDING_SIGNUP_DISCOUNT_MAX_AGE_MS) {
      return null;
    }

    return {
      source: parsed.source,
      returnTo: parsed.returnTo,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function readPendingSignupDiscount(now = Date.now()): PendingSignupDiscountState | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.localStorage.getItem(PENDING_SIGNUP_DISCOUNT_KEY);
  const state = parsePendingSignupDiscount(rawValue, now);
  if (!state && rawValue) {
    window.localStorage.removeItem(PENDING_SIGNUP_DISCOUNT_KEY);
  }
  return state;
}

export function writePendingSignupDiscount(
  state: PendingSignupDiscountState,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    PENDING_SIGNUP_DISCOUNT_KEY,
    serializePendingSignupDiscount(state),
  );
}

export function clearPendingSignupDiscount(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_SIGNUP_DISCOUNT_KEY);
}
