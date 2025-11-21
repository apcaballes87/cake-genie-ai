import { getSupabaseClient } from '../lib/supabase/client';
import { devLog } from '../lib/utils/devLog';

const supabase = getSupabaseClient();

/**
 * Generate a discount code for a contributor
 */
export async function generateContributorDiscountCode(
  userId: string,
  contributionAmount: number
): Promise<string | null> {
  try {
    // Generate code: FRIEND{last 4 of user id}
    const code = `FRIEND${userId.slice(-4).toUpperCase()}`;

    const { error } = await supabase
      .from('discount_codes')
      .insert({
        user_id: userId,
        code: code,
        discount_amount: 100, // ₱100 off
        reason: 'contributed',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });

    if (error) {
      // If the code already exists (e.g., user contributed before), it's not a critical failure.
      // We can just return the predictable code.
      if (error.code === '23505') { // unique_violation
        devLog.log(`Discount code ${code} already exists for user ${userId}. Reusing it.`);
        return code;
      }
      console.error('Error creating discount code:', error);
      return null;
    }

    return code;
  } catch (error) {
    console.error('Exception creating discount code:', error);
    return null;
  }
}
