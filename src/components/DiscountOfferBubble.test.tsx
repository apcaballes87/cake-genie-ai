import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscountOfferBubble } from './DiscountOfferBubble';
import {
  PENDING_SIGNUP_DISCOUNT_KEY,
  serializePendingSignupDiscount,
} from '@/lib/auth/signupDiscountReturnState';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'user-1', is_anonymous: false },
    isAuthenticated: true,
    isLoading: false,
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
  },
  validateDiscountCode: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/services/discountService', () => ({
  validateDiscountCode: mocks.validateDiscountCode,
}));

vi.mock('@/lib/utils/toast', () => ({
  showSuccess: mocks.showSuccess,
  showError: mocks.showError,
}));

describe('DiscountOfferBubble', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    mocks.auth = {
      user: { id: 'user-1', is_anonymous: false },
      isAuthenticated: true,
      isLoading: false,
      signUp: vi.fn(),
      signInWithGoogle: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };
    mocks.validateDiscountCode.mockReset();
    mocks.showSuccess.mockReset();
    mocks.showError.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('resumes OAuth signup, validates the code, updates the sticky price, and clears pending state', async () => {
    const onApplied = vi.fn();
    window.localStorage.setItem(PENDING_SIGNUP_DISCOUNT_KEY, serializePendingSignupDiscount({
      source: 'bubble',
      returnTo: '/customizing/example',
      createdAt: Date.now(),
    }));
    vi.mocked(fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: true, code: 'GENIEABC123' }),
    } as Response);
    mocks.validateDiscountCode.mockResolvedValue({
      valid: true,
      codeId: 'code-1',
      discountAmount: 160,
      originalAmount: 800,
      finalAmount: 640,
      message: 'Discount code applied successfully!',
    });

    render(<DiscountOfferBubble basePrice={800} onApplied={onApplied} />);

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(PENDING_SIGNUP_DISCOUNT_KEY)).toBeNull();
    expect(window.localStorage.getItem('cart_discount_code')).toBe('GENIEABC123');
    expect(JSON.parse(window.localStorage.getItem('cart_applied_discount') || '{}')).toMatchObject({
      valid: true,
      codeId: 'code-1',
    });
  });

  it('keeps pending state and does not signal applied when validation fails', async () => {
    const onApplied = vi.fn();
    const pending = serializePendingSignupDiscount({
      source: 'bubble',
      returnTo: '/customizing/example',
      createdAt: Date.now(),
    });
    window.localStorage.setItem(PENDING_SIGNUP_DISCOUNT_KEY, pending);
    vi.mocked(fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: true, code: 'GENIEABC123' }),
    } as Response);
    mocks.validateDiscountCode.mockResolvedValue({
      valid: false,
      discountAmount: 0,
      originalAmount: 800,
      finalAmount: 800,
      message: 'You must be logged in to use this discount code',
    });

    render(<DiscountOfferBubble basePrice={800} onApplied={onApplied} />);

    await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith(
      'You must be logged in to use this discount code',
    ));
    expect(onApplied).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PENDING_SIGNUP_DISCOUNT_KEY)).toBe(pending);
    expect(window.localStorage.getItem('cart_discount_code')).toBeNull();
  });

  it('passes the exact current URL, including query and hash, to Google OAuth', async () => {
    mocks.auth = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      signUp: vi.fn(),
      signInWithGoogle: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };
    window.history.replaceState({}, '', '/customizing/example?size=8#summary');

    render(<DiscountOfferBubble basePrice={800} />);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(mocks.auth.signInWithGoogle).toHaveBeenCalledWith(
      '/customizing/example?size=8#summary',
    ));
    expect(JSON.parse(window.localStorage.getItem(PENDING_SIGNUP_DISCOUNT_KEY) || '{}')).toMatchObject({
      source: 'bubble',
      returnTo: '/customizing/example?size=8#summary',
    });
  });
});
