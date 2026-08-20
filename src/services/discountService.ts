import { getSupabaseClient } from '@/lib/supabase/client';
import type { DiscountValidationResult } from '@/types';

const supabase = getSupabaseClient();

export type DiscountValidationOptions = {
  email?: string;
  eligibleSubtotal?: number;
  eligibleQuantity?: number;
};

export type UserDiscountCode = {
  code_id: string;
  code: string;
  discount_amount: number | null;
  discount_percentage: number | null;
};

type CreatorDiscountRpcResult = {
  valid: boolean;
  code_id: string | null;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  message: string;
  free_delivery: boolean;
  discount_type: string | null;
  discount_value: number;
};

/**
 * Validates a discount code and returns the calculated discount
 * Checks all restrictions: active, expired, usage limits, user restrictions, etc.
 */
export async function validateDiscountCode(
  code: string,
  orderAmount: number,
  options: DiscountValidationOptions = {}
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

    // Private creator codes are intentionally hidden by RLS. Validate them
    // through a sanitized RPC instead of exposing their email restriction.
    if (error || !discountCode) {
      const { data: creatorResult, error: creatorError } = await supabase.rpc('validate_creator_discount_code', {
        p_code: normalizedCode,
        p_order_amount: orderAmount,
        p_email: options.email?.trim().toLowerCase() || null,
        p_eligible_subtotal: options.eligibleSubtotal ?? null,
        p_eligible_quantity: options.eligibleQuantity ?? null,
      });
      const creatorValidation = (Array.isArray(creatorResult) ? creatorResult[0] : creatorResult) as CreatorDiscountRpcResult | null;

      if (!creatorError && creatorValidation) {
        return {
          valid: creatorValidation.valid,
          discountAmount: Number(creatorValidation.discount_amount ?? 0),
          codeId: creatorValidation.code_id || undefined,
          originalAmount: Number(creatorValidation.original_amount ?? orderAmount),
          finalAmount: Number(creatorValidation.final_amount ?? orderAmount),
          message: creatorValidation.message,
          freeDelivery: creatorValidation.free_delivery,
          discountType: creatorValidation.discount_type as DiscountValidationResult['discountType'],
          discountValue: Number(creatorValidation.discount_value ?? 0),
        };
      }

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
    if (discountCode.minimum_order_amount && orderAmount < discountCode.minimum_order_amount) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: `Minimum order amount of ₱${discountCode.minimum_order_amount} required`,
      };
    }

    if (discountCode.eligible_email
      && options.email?.trim().toLowerCase() !== String(discountCode.eligible_email).trim().toLowerCase()) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This code is only valid for the creator email',
      };
    }

    let discountBaseAmount = orderAmount;
    if (Array.isArray(discountCode.applies_to_cake_types) && discountCode.applies_to_cake_types.length > 0) {
      if (!options.eligibleSubtotal || options.eligibleSubtotal <= 0) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'This code requires an eligible bento cake in your cart',
        };
      }
      discountBaseAmount = options.eligibleSubtotal;
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
        .eq('user_id', user.id)
        .in('payment_status', ['paid', 'partial', 'refunded']);

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
      discountAmount = (discountBaseAmount * discountCode.discount_percentage) / 100;
    }

    console.log('🎫 Discount calculation:', {
      code: normalizedCode,
      orderAmount,
      discount_percentage: discountCode.discount_percentage,
      discount_amount: discountCode.discount_amount,
      max_discount_amount: discountCode.max_discount_amount,
      calculatedDiscountAmount: discountAmount,
    });

    // Apply max discount cap if set
    if (discountCode.max_discount_amount !== null && discountCode.max_discount_amount !== undefined) {
      discountAmount = Math.min(discountAmount, Number(discountCode.max_discount_amount));
    }

    // Ensure discount doesn't exceed order amount, but don't let it go below zero.
    discountAmount = Math.min(discountAmount, discountBaseAmount);
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    const freeDelivery = discountCode.free_delivery === true;
    const discountType = discountCode.discount_percentage ? 'percentage' : 
                         discountCode.discount_amount ? 'fixed' : 'free_delivery';
    const discountValue = discountCode.discount_percentage || discountCode.discount_amount || 0;

    return {
      valid: true,
      discountAmount,
      codeId: discountCode.code_id,
      originalAmount: orderAmount,
      finalAmount,
      message: 'Discount code applied successfully!',
      freeDelivery,
      discountType,
      discountValue,
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
 * Get user's available discount codes.
 */
export async function getUserDiscountCodes(): Promise<UserDiscountCode[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Temporarily disabled - RPC function not yet created
    const userDiscounts: UserDiscountCode[] = [];
    return userDiscounts;
  } catch (error) {
    console.error('Exception fetching user discount codes:', error);
    return [];
  }
}
