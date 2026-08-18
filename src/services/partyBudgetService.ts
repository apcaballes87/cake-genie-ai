import { createClient } from '@/lib/supabase/client';
import type { PartyBudgetSnapshot, SavedPartyBudget } from '@/lib/partyBudget';

type PartyBudgetSummary = {
  partyDate: string;
  guestCount: number;
  totalAmount: number;
  budgetAmount: number | null;
  currency: string;
};

export async function getPartyBudget(userId: string): Promise<SavedPartyBudget | null> {
  const { data, error } = await createClient()
    .from('cakegenie_party_budgets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as SavedPartyBudget | null;
}
export async function savePartyBudget(
  userId: string,
  snapshot: PartyBudgetSnapshot,
  summary: PartyBudgetSummary
): Promise<SavedPartyBudget> {
  const { data, error } = await createClient()
    .from('cakegenie_party_budgets')
    .upsert(
      {
        user_id: userId,
        party_date: summary.partyDate || null,
        guest_count: summary.guestCount,
        total_amount: summary.totalAmount,
        budget_amount: summary.budgetAmount,
        currency: summary.currency,
        budget_data: snapshot,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as SavedPartyBudget;
}
