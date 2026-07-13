import { isValidRedirect } from '@/lib/utils/urlHelpers';

export const PENDING_AUTH_RETURN_KEY = 'pendingAuthReturn';
const PENDING_AUTH_RETURN_MAX_AGE_MS = 30 * 60 * 1000;

interface PendingAuthReturn {
  returnTo: string;
  createdAt: number;
}

export function writePendingAuthReturn(returnTo: string): void {
  if (typeof window === 'undefined' || !isValidRedirect(returnTo)) return;

  window.localStorage.setItem(PENDING_AUTH_RETURN_KEY, JSON.stringify({
    returnTo,
    createdAt: Date.now(),
  } satisfies PendingAuthReturn));
}

export function readPendingAuthReturn(now = Date.now()): string | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.localStorage.getItem(PENDING_AUTH_RETURN_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<PendingAuthReturn>;
    const age = now - (parsed.createdAt ?? 0);
    if (
      typeof parsed.returnTo !== 'string' ||
      !isValidRedirect(parsed.returnTo) ||
      typeof parsed.createdAt !== 'number' ||
      !Number.isFinite(parsed.createdAt) ||
      age < 0 ||
      age > PENDING_AUTH_RETURN_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(PENDING_AUTH_RETURN_KEY);
      return null;
    }

    return parsed.returnTo;
  } catch {
    window.localStorage.removeItem(PENDING_AUTH_RETURN_KEY);
    return null;
  }
}

export function clearPendingAuthReturn(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PENDING_AUTH_RETURN_KEY);
  }
}
