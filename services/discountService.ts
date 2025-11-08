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
    console.log('🎫 Validating discount code:', { code, normalizedCode, orderAmount });

    // Direct query to discount_codes table
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    console.log('📊 Query result:', {
      found: !!discountCode,
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details
    });

    // If code doesn't exist
    if (error || !discountCode) {
      console.log('❌ Code not found or error occurred');
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'Invalid discount code',
      };
    }

    console.log('✅ Code found:', discountCode);

    // Check if active
    console.log('🔍 Checking is_active:', discountCode.is_active);
    if (!discountCode.is_active) {
      console.log('❌ Code is not active');
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
      console.log('📅 Checking expiration:', {
        expirationDate,
        now,
        isExpired: expirationDate < now
      });

      if (expirationDate < now) {
        console.log('❌ Code is expired');
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: `This code expired on ${expirationDate.toLocaleDateString()}`,
        };
      }
    }
    console.log('✅ Expiration check passed');

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

    // Check if user is authenticated (required for user-restricted codes)
    if ((discountCode.one_per_user || discountCode.new_users_only) && !user) {
      console.log('❌ User must be logged in for this code');
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'You must be logged in to use this discount code',
      };
    }

    // Check if code is for new users only
    if (discountCode.new_users_only && user) {
      console.log('🔍 Checking if user is new (has no previous orders)...');

      // Check if user has any completed orders
      const { data: previousOrders, error: ordersError } = await supabase
        .from('cakegenie_orders')
        .select('order_id')
        .eq('user_id', user.id)
        .limit(1);

      if (ordersError) {
        console.error('Error checking previous orders:', ordersError);
      }

      if (previousOrders && previousOrders.length > 0) {
        console.log('❌ User has previous orders, not eligible for new user code');
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'This code is only for new customers',
        };
      }

      console.log('✅ User is new, eligible for code');
    }

    // Check if user has already used this code (one per user restriction)
    if (discountCode.one_per_user && user) {
      console.log('🔍 Checking if user has used this code before...');

      const { data: previousUsage, error: usageError } = await supabase
        .from('discount_code_usage')
        .select('usage_id')
        .eq('discount_code_id', discountCode.code_id)
        .eq('user_id', user.id)
        .limit(1);

      if (usageError) {
        console.error('Error checking code usage:', usageError);
      }

      if (previousUsage && previousUsage.length > 0) {
        console.log('❌ User has already used this code');
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'You have already used this discount code',
        };
      }

      console.log('✅ User has not used this code before');
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
 * Record discount code usage
 */
export async function recordDiscountCodeUsage(
  discountCodeId: string,
  userId: string,
  orderId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    console.log('📝 Recording discount code usage:', { discountCodeId, userId, orderId });

    const { error } = await supabase
      .from('discount_code_usage')
      .insert({
        discount_code_id: discountCodeId,
        user_id: userId,
        order_id: orderId,
      });

    if (error) {
      console.error('❌ Error recording discount code usage:', error);
      return { success: false, error };
    }

    console.log('✅ Discount code usage recorded successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Exception recording discount code usage:', error);
    return { success: false, error };
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