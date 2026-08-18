import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountClient from './AccountClient';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn(),
  getPartyBudget: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'customer-1', email: 'party@example.com', is_anonymous: false },
    isAuthenticated: true,
    isLoading: false,
    signOut: mocks.signOut,
  }),
}));

vi.mock('@/services/partyBudgetService', () => ({
  getPartyBudget: mocks.getPartyBudget,
}));

vi.mock('@/components/MobileBottomNav', () => ({ default: () => null }));

describe('AccountClient party budget', () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.signOut.mockReset();
    mocks.getPartyBudget.mockReset().mockResolvedValue({
      user_id: 'customer-1',
      party_date: '2026-12-05',
      guest_count: 45,
      total_amount: 94068,
      budget_amount: 100000,
      currency: 'PHP',
      budget_data: { meta: {}, lineItems: {} },
      created_at: '2026-08-17T00:00:00Z',
      updated_at: '2026-08-17T00:00:00Z',
    });
  });

  it('shows the saved budget summary directly on My Account', async () => {
    render(<AccountClient />);

    await waitFor(() => expect(mocks.getPartyBudget).toHaveBeenCalledWith('customer-1'));
    expect(await screen.findByRole('heading', { name: 'My Party Budget' })).toBeVisible();
    expect(screen.getByText('₱94,068')).toBeVisible();
    expect(screen.getByText('45 guests')).toBeVisible();
    expect(screen.getByRole('button', { name: 'View budget' })).toBeVisible();
  });
});
