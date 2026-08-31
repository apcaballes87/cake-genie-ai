import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('clears the pending-save flag when reset is clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem(PENDING_PARTY_BUDGET_SAVE_KEY, 'true');

    render(<PartyBudgetCalculator />);

    await user.click(screen.getByRole('button', { name: 'Save Details' }));

    expect(localStorage.getItem(PENDING_PARTY_BUDGET_SAVE_KEY)).toBe('true');

    await user.click(screen.getByRole('button', { name: /Reset planner/ }));

    expect(localStorage.getItem(PENDING_PARTY_BUDGET_SAVE_KEY)).toBeNull();
    expect(localStorage.getItem(PARTY_BUDGET_ITEMS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PARTY_BUDGET_META_STORAGE_KEY)).toBeNull();
  });

  it('fetches cloud data on mount for a logged-in user (second-device scenario)', async () => {
    const cloudSnapshot = {
      meta: {
        partyDate: '2026-12-25',
        guestCount: 50,
        childCount: 30,
        kidsAttending: true,
        currency: 'USD',
        overallBudget: '10000',
        contingency: 10,
      },
      lineItems: {
        venue: [{
          id: 'cloud-venue',
          label: 'Cloud venue',
          description: 'From another device',
          cost: 3000,
          qty: 1,
        }],
      },
    };
    mocks.getPartyBudget.mockResolvedValue({ budget_data: cloudSnapshot });
    mocks.auth.user = { id: 'user-device-2', is_anonymous: false };
    mocks.auth.isAuthenticated = true;

    render(<PartyBudgetCalculator />);

    await waitFor(() => expect(mocks.getPartyBudget).toHaveBeenCalledWith('user-device-2'));
    expect(screen.getByLabelText('Cloud venue unit cost')).toHaveValue(3000);
    expect(screen.getByDisplayValue('2026-12-25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10000')).toBeInTheDocument();
  });

  it('overwrites stale localStorage with cloud data on re-login', async () => {
    localStorage.setItem(PARTY_BUDGET_ITEMS_STORAGE_KEY, JSON.stringify({
      venue: [{
        id: 'stale-venue',
        label: 'Stale venue',
        description: 'Old local data',
        cost: 999,
        qty: 1,
      }],
    }));
    localStorage.setItem(PARTY_BUDGET_META_STORAGE_KEY, JSON.stringify({
      partyDate: '2026-01-01',
      guestCount: 10,
      childCount: 5,
      kidsAttending: false,
      currency: 'PHP',
      overallBudget: '5000',
      contingency: 5,
    }));

    const cloudSnapshot = {
      meta: {
        partyDate: '2026-06-15',
        guestCount: 80,
        childCount: 40,
        kidsAttending: true,
        currency: 'EUR',
        overallBudget: '20000',
        contingency: 12,
      },
      lineItems: {
        venue: [{
          id: 'cloud-venue-fresh',
          label: 'Fresh cloud venue',
          description: 'From cloud',
          cost: 5000,
          qty: 1,
        }],
      },
    };
    mocks.getPartyBudget.mockResolvedValue({ budget_data: cloudSnapshot });
    mocks.auth.user = { id: 'user-relogin', is_anonymous: false };
    mocks.auth.isAuthenticated = true;

    render(<PartyBudgetCalculator />);

    await waitFor(() => expect(mocks.getPartyBudget).toHaveBeenCalledWith('user-relogin'));
    expect(screen.getByLabelText('Fresh cloud venue unit cost')).toHaveValue(5000);
    expect(screen.getByDisplayValue('2026-06-15')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20000')).toBeInTheDocument();
  });

  it('shows the visible row count below the price only while a category is collapsed', async () => {
    const user = userEvent.setup();
    render(<PartyBudgetCalculator />);

    const foodCard = document.getElementById('category-card-food');
    expect(foodCard).not.toBeNull();
    const food = within(foodCard!);
    const toggle = food.getByRole('button', { name: /Food & Catering/ });

    expect(food.queryByText('2 items')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(food.getByText('2 items')).toBeVisible();
    expect(food.queryByLabelText('Catering (per guest) details')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Kids attending' }));
    expect(food.getByText('1 item')).toBeVisible();

    await user.click(toggle);
    expect(food.queryByText('1 item')).not.toBeInTheDocument();
    await user.click(food.getByRole('button', { name: 'Add custom item' }));
    await user.click(toggle);
    expect(food.getByText('2 items')).toBeVisible();
  });
});
