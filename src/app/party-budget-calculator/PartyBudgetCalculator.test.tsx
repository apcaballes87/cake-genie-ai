import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PartyBudgetCalculator from './PartyBudgetCalculator';
import {
  PARTY_BUDGET_ITEMS_STORAGE_KEY,
  PARTY_BUDGET_META_STORAGE_KEY,
  PENDING_PARTY_BUDGET_SAVE_KEY,
} from '@/lib/partyBudget';

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string; is_anonymous?: boolean },
    isAuthenticated: false,
    isLoading: false,
  },
  getPartyBudget: vi.fn(),
  savePartyBudget: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/services/partyBudgetService', () => ({
  getPartyBudget: mocks.getPartyBudget,
  savePartyBudget: mocks.savePartyBudget,
}));

vi.mock('@/lib/utils/toast', () => ({
  showError: mocks.showError,
  showSuccess: mocks.showSuccess,
}));

vi.mock('@/components/PartyBudgetSignupModal', () => ({
  default: () => <div role="dialog">Save your party budget</div>,
}));

describe('PartyBudgetCalculator', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.auth.user = null;
    mocks.auth.isAuthenticated = false;
    mocks.auth.isLoading = false;
    mocks.getPartyBudget.mockReset().mockResolvedValue(null);
    mocks.savePartyBudget.mockReset().mockResolvedValue({});
    mocks.showError.mockReset();
    mocks.showSuccess.mockReset();
  });

  it('restores the existing local draft before local auto-save starts', async () => {
    localStorage.setItem(PARTY_BUDGET_ITEMS_STORAGE_KEY, JSON.stringify({
      venue: [{
        id: 'venue-rental',
        label: 'Venue rental',
        description: 'Party hall',
        cost: 12345,
        qty: 1,
        vendor: 'Paid deposit; contact Ana',
      }],
    }));
    localStorage.setItem(PARTY_BUDGET_META_STORAGE_KEY, JSON.stringify({
      partyDate: '2026-10-12',
      guestCount: 42,
      childCount: 20,
      kidsAttending: true,
      currency: 'PHP',
      overallBudget: '75000',
      contingency: 8,
    }));

    render(<PartyBudgetCalculator />);

    expect(await screen.findByLabelText('Venue rental details')).toHaveValue('Paid deposit; contact Ana');
    expect(screen.getByLabelText('Venue rental details')).toHaveAttribute('placeholder', 'Details (Optional)');
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(PARTY_BUDGET_META_STORAGE_KEY) || '{}').guestCount).toBe(42);
    });
  });

  it('opens the account sign-up prompt and preserves a pending save for guests', async () => {
    const user = userEvent.setup();
    render(<PartyBudgetCalculator />);

    await user.click(screen.getByRole('button', { name: 'Save Details' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Save your party budget');
    expect(localStorage.getItem(PENDING_PARTY_BUDGET_SAVE_KEY)).toBe('true');
    expect(mocks.savePartyBudget).not.toHaveBeenCalled();
  });

  it('saves the current planner directly for a registered customer', async () => {
    const user = userEvent.setup();
    mocks.auth.user = { id: 'customer-1', is_anonymous: false };
    mocks.auth.isAuthenticated = true;

    render(<PartyBudgetCalculator />);
    await waitFor(() => expect(mocks.getPartyBudget).toHaveBeenCalledWith('customer-1'));
    await user.click(screen.getByRole('button', { name: 'Save Details' }));

    await waitFor(() => expect(mocks.savePartyBudget).toHaveBeenCalledTimes(1));
    expect(mocks.savePartyBudget.mock.calls[0][0]).toBe('customer-1');
    expect(mocks.savePartyBudget.mock.calls[0][1].meta.guestCount).toBe(30);
    expect(mocks.showSuccess).toHaveBeenCalledWith('Party budget saved to your account.');
  });

  it('finishes a pending guest save once authentication returns', async () => {
    mocks.auth.user = { id: 'customer-2', is_anonymous: false };
    mocks.auth.isAuthenticated = true;
    localStorage.setItem(PENDING_PARTY_BUDGET_SAVE_KEY, 'true');

    render(<PartyBudgetCalculator />);

    await waitFor(() => expect(mocks.savePartyBudget).toHaveBeenCalledTimes(1));
    expect(mocks.savePartyBudget.mock.calls[0][0]).toBe('customer-2');
    expect(localStorage.getItem(PENDING_PARTY_BUDGET_SAVE_KEY)).toBeNull();
    expect(mocks.getPartyBudget).not.toHaveBeenCalled();
  });
});
