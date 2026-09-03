import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPartyBudget, savePartyBudget } from './partyBudgetService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mocks.from }),
}));

describe('partyBudgetService', () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it('loads the single budget owned by the customer', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ select });

    await expect(getPartyBudget('user-1')).resolves.toMatchObject({ user_id: 'user-1' });
    expect(mocks.from).toHaveBeenCalledWith('cakegenie_party_budgets');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('upserts one current budget per customer', async () => {
    const single = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
    const selectAfterUpsert = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select: selectAfterUpsert }));
    mocks.from.mockReturnValue({ upsert });
    const snapshot = {
      meta: {
        partyName: 'Genie\'s Birthday', partyDate: '2026-11-01', guestCount: 30, childCount: 20, kidsAttending: true,
        currency: 'PHP', overallBudget: '50000', contingency: 8,
      },
      lineItems: {},
    };

    await savePartyBudget('user-1', snapshot, {
      partyDate: '2026-11-01', guestCount: 30, totalAmount: 25000, budgetAmount: 50000, currency: 'PHP',
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      party_date: '2026-11-01',
      budget_data: snapshot,
    }), { onConflict: 'user_id' });
  });
});
