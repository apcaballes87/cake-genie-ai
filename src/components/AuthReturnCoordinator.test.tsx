import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthReturnCoordinator from './AuthReturnCoordinator';
import { PENDING_SIGNUP_DISCOUNT_KEY, serializePendingSignupDiscount } from '@/lib/auth/signupDiscountReturnState';
import { PENDING_AUTH_RETURN_KEY } from '@/lib/auth/pendingAuthReturn';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1', is_anonymous: false },
  },
  pathname: '/',
  replaceBrowserLocation: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@/lib/auth/browserRedirect', () => ({
  replaceBrowserLocation: mocks.replaceBrowserLocation,
}));

describe('AuthReturnCoordinator', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.auth = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'user-1', is_anonymous: false },
    };
    mocks.pathname = '/';
    mocks.replaceBrowserLocation.mockReset();
  });

  it('returns an authenticated user to the saved customizer URL', async () => {
    window.localStorage.setItem(PENDING_SIGNUP_DISCOUNT_KEY, serializePendingSignupDiscount({
      source: 'bubble',
      returnTo: '/customizing/example?size=8',
      createdAt: Date.now(),
    }));
    render(<AuthReturnCoordinator />);

    await waitFor(() => expect(mocks.replaceBrowserLocation).toHaveBeenCalledWith('/customizing/example?size=8'));
  });

  it('does not redirect when the browser is already on the saved URL', () => {
    mocks.pathname = '/customizing/example';
    window.history.replaceState({}, '', '/customizing/example?size=8');
    window.localStorage.setItem(PENDING_SIGNUP_DISCOUNT_KEY, serializePendingSignupDiscount({
      source: 'bubble',
      returnTo: '/customizing/example?size=8',
      createdAt: Date.now(),
    }));
    render(<AuthReturnCoordinator />);

    expect(mocks.replaceBrowserLocation).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '/');
  });

  it('waits for a real authenticated user', () => {
    mocks.auth = {
      isAuthenticated: false,
      isLoading: false,
      user: null,
    };
    window.localStorage.setItem(PENDING_SIGNUP_DISCOUNT_KEY, serializePendingSignupDiscount({
      source: 'bubble',
      returnTo: '/customizing/example',
      createdAt: Date.now(),
    }));
    render(<AuthReturnCoordinator />);

    expect(mocks.replaceBrowserLocation).not.toHaveBeenCalled();
  });

  it('returns an authenticated Google user to the saved cart when callback next is lost', async () => {
    window.localStorage.setItem(PENDING_AUTH_RETURN_KEY, JSON.stringify({
      returnTo: '/cart',
      createdAt: Date.now(),
    }));
    render(<AuthReturnCoordinator />);

    await waitFor(() => expect(mocks.replaceBrowserLocation).toHaveBeenCalledWith('/cart'));
  });
});
