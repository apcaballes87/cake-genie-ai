import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

export interface DiscountValidationResult {
  valid: boolean;
  discountAmount: number;
  codeId?: string;
  originalAmount: number;
  finalAmount: number;
  message?: string;
  error?: string;
}

/**
 * Validate a discount code for a given order amount
 */
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<DiscountValidationResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('validate-discount-code', {
      body: { code, orderAmount },
      headers: session ? {
        Authorization: `Bearer ${session.access_token}`
      } : {}
    });

    if (error) {
      console.error('Error validating discount code:', error);
      return { 
        valid: false, 
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        error: 'Failed to validate code' 
      };
    }

    return data;
  } catch (error) {
    console.error('Exception validating discount code:', error);
    return { 
      valid: false, 
      discountAmount: 0,
      originalAmount: orderAmount,
      finalAmount: orderAmount,
      error: 'An error occurred' 
    };
  }
}

/**
 * Get user's available discount codes
 */
export async function getUserDiscountCodes(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('times_used', 0) // Not used yet
      .gt('expires_at', new Date().toISOString()) // Not expired
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching discount codes:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching discount codes:', error);
    return [];
  }
}
