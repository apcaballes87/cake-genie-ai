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
    const normalizedCode = code.trim().toUpperCase();
    
    // Direct query to discount_codes table
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    // If code doesn't exist
    if (error || !discountCode) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'Invalid discount code',
      };
    }

    // Check if active
    if (!discountCode.is_active) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This discount code is no longer active',
      };
    }

    // Check expiration
    if (discountCode.expires_at) {
      const expirationDate = new Date(discountCode.expires_at);
      const now = new Date();
      
      if (expirationDate < now) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: `This code expired on ${expirationDate.toLocaleDateString()}`,
        };
      }
    }

    // Check usage limit
    if (discountCode.times_used >= discountCode.max_uses) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This discount code has reached its usage limit',
      };
    }

    // Check minimum order amount
    if (discountCode.min_order_amount && orderAmount < discountCode.min_order_amount) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: `Minimum order amount of ₱${discountCode.min_order_amount} required`,
      };
    }

    // Check user-specific codes
    const { data: { user } } = await supabase.auth.getUser();
    if (discountCode.user_id && discountCode.user_id !== user?.id) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This code is not valid for your account',
      };
    }

    // Calculate discount
    let discountAmount = 0;
    if (discountCode.discount_amount > 0) {
      discountAmount = discountCode.discount_amount;
    } else if (discountCode.discount_percentage > 0) {
      discountAmount = (orderAmount * discountCode.discount_percentage) / 100;
    }

    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      valid: true,
      discountAmount,
      codeId: discountCode.code_id,
      originalAmount: orderAmount,
      finalAmount,
      message: 'Discount code applied successfully!',
    };
  } catch (error) {
    console.error('Error validating discount code:', error);
    return {
      valid: false,
      discountAmount: 0,
      originalAmount: orderAmount,
      finalAmount: orderAmount,
      message: 'Error validating discount code',
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