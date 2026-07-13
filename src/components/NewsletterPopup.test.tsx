import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import NewsletterPopup from './NewsletterPopup';

const auth = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('@/lib/analytics', () => ({
  trackSignUp: vi.fn(),
}));

describe('NewsletterPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders above the shared header and keeps the close action reachable', async () => {
    render(<NewsletterPopup />);

    await act(async () => {
      vi.advanceTimersByTime(25_000);
    });

    expect(document.querySelector('[data-newsletter-popup-overlay]')).toHaveClass('z-[1000]', 'backdrop-blur-sm');
    expect(document.querySelector('[data-newsletter-popup-layer]')).toHaveClass('z-[1010]');
    expect(screen.getByRole('dialog')).toHaveClass('max-h-[calc(100dvh-2rem)]');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
