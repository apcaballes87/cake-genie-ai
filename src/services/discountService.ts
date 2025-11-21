import { getSupabaseClient } from '../lib/supabase/client';
import type { DiscountValidationResult } from '../types';

const supabase = getSupabaseClient();

/**
 * Validates a discount code and returns the calculated discount
 * Checks all restrictions: active, expired, usage limits, user restrictions, etc.
 */
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<DiscountValidationResult> {
  try {
    const normalizedCode = code.trim().toUpperCase();
    console.log('🎫 Validating discount code:', { code: normalizedCode, orderAmount });

    // Query the discount_codes table
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    // Code doesn't exist
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
      if (expirationDate < new Date()) {
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
    if (discountCode.max_uses !== null && discountCode.times_used >= discountCode.max_uses) {
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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Check if code is user-specific
    if (discountCode.user_id && discountCode.user_id !== user?.id) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This code is not valid for your account',
      };
    }

    // Check if user needs to be logged in
    if ((discountCode.one_per_user || discountCode.new_users_only) && (!user || user.is_anonymous)) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'You must be logged in to use this discount code',
      };
    }

    // Check new users only restriction
    if (discountCode.new_users_only && user) {
      const { count } = await supabase
        .from('cakegenie_orders')
        .select('order_id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (count && count > 0) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'This code is only for new customers',
        };
      }
    }

    // Check one-per-user restriction
    if (discountCode.one_per_user && user) {
      const { count } = await supabase
        .from('discount_code_usage')
        .select('usage_id', { count: 'exact', head: true })
        .eq('discount_code_id', discountCode.code_id)
        .eq('user_id', user.id);

      if (count && count > 0) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'You have already used this discount code',
        };
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discount_amount) {
      discountAmount = discountCode.discount_amount;
    } else if (discountCode.discount_percentage) {
      discountAmount = (orderAmount * discountCode.discount_percentage) / 100;
    }

    // Ensure discount doesn't exceed order amount, but don't let it go below zero.
    discountAmount = Math.min(discountAmount, orderAmount);
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
      message: 'An unexpected error occurred while validating the code.',
    };
  }
}

/**
 * Records that a user used a discount code (call after order creation)
 * NOTE: This is handled by the `create_order_from_cart` RPC and is redundant for the main flow.
 */
export async function recordDiscountCodeUsage(
  discountCodeId: string,
  userId: string,
  orderId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('discount_code_usage')
      .insert({
        discount_code_id: discountCodeId,
        user_id: userId,
        order_id: orderId,
      });

    if (error) {
      console.error('Error recording discount usage:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception recording discount usage:', error);
    return { success: false, error };
  }
}

/**
 * Get user's available discount codes.
 */
export async function getUserDiscountCodes(): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Temporarily disabled - RPC function not yet created
    const userDiscounts: any[] = [];
    return userDiscounts;
  } catch (error) {
    console.error('Exception fetching user discount codes:', error);
    return [];
  }
}