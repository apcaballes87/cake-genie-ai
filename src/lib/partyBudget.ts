export const PARTY_BUDGET_ITEMS_STORAGE_KEY = 'party-budget-data';
export const PARTY_BUDGET_META_STORAGE_KEY = 'party-budget-meta';
export const PENDING_PARTY_BUDGET_SAVE_KEY = 'party-budget-pending-save';

export type PartyBudgetItem = {
  id: string;
  label: string;
  description: string;
  cost: number;
  qty?: number;
  vendor?: string;
  perGuest?: boolean;
  perChild?: boolean;
  isCustom?: boolean;
};

export type PartyBudgetMeta = {
  partyDate: string;
  guestCount: number;
  childCount: number;
  kidsAttending: boolean;
  currency: string;
  overallBudget: string;
  contingency: number;
};

export type PartyBudgetSnapshot = {
  meta: PartyBudgetMeta;
  lineItems: Record<string, PartyBudgetItem[]>;
};

export type SavedPartyBudget = {
  user_id: string;
  party_date: string | null;
  guest_count: number;
  total_amount: number;
  budget_amount: number | null;
  currency: string;
  budget_data: PartyBudgetSnapshot;
  created_at: string;
  updated_at: string;
};

export function isPartyBudgetSnapshot(value: unknown): value is PartyBudgetSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<PartyBudgetSnapshot>;
  if (!snapshot.meta || typeof snapshot.meta !== 'object' || !snapshot.lineItems || typeof snapshot.lineItems !== 'object') {
    return false;
  }

  return Object.values(snapshot.lineItems).every((items) => Array.isArray(items));
}
