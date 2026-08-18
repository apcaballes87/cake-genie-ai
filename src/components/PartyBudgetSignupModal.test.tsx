import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PartyBudgetSignupModal from './PartyBudgetSignupModal';

const mocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signInWithGoogle: mocks.signInWithGoogle }),
}));

vi.mock('@/lib/utils/toast', () => ({ showError: mocks.showError }));

describe('PartyBudgetSignupModal', () => {
  beforeEach(() => {
    mocks.signInWithGoogle.mockReset().mockResolvedValue({ error: null });
    mocks.showError.mockReset();
    document.body.style.overflow = '';
  });

  it('offers account creation and returns both auth paths to the calculator', () => {
    render(<PartyBudgetSignupModal onClose={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Sign up with email' })).toHaveAttribute(
      'href',
      '/signup?redirect=%2Fparty-budget-calculator'
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Fparty-budget-calculator'
    );
  });

  it('uses the calculator as the Google authentication return target', async () => {
    const user = userEvent.setup();
    render(<PartyBudgetSignupModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mocks.signInWithGoogle).toHaveBeenCalledWith('/party-budget-calculator'));
  });
});
