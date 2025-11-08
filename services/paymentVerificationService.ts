// services/paymentVerificationService.ts
import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

export interface PaymentVerificationResult {
  success: boolean;
  status: 'paid' | 'pending' | 'expired' | 'failed';
  message?: string;
  error?: string;
}

/**
 * Manually verify a contribution payment with Xendit
 * This is a backup when webhooks fail
 */
export async function verifyContributionPayment(
  contributionId: string
): Promise<PaymentVerificationResult> {
  try {
    console.log('🔍 Verifying payment for contribution:', contributionId);

    const { data, error } = await supabase.functions.invoke('verify-contribution-payment', {
      body: { contributionId }
    });

    if (error) {
      console.error('❌ Verification error:', error);
      return {
        success: false,
        status: 'pending',
        error: 'Failed to verify payment'
      };
    }

    console.log('✅ Verification result:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception during verification:', error);
    return {
      success: false,
      status: 'pending',
      error: 'An error occurred during verification'
    };
  }
}

/**
 * Poll for payment status after redirect from Xendit
 */
export async function pollPaymentStatus(
  contributionId: string,
  maxAttempts: number = 10,
  intervalMs: number = 3000
): Promise<PaymentVerificationResult> {
  console.log(`🔄 Starting payment polling (max ${maxAttempts} attempts)`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Attempt ${attempt}/${maxAttempts}`);

    // First check database
    const { data: contribution, error } = await supabase
      .from('bill_contributions')
      .select('status')
      .eq('contribution_id', contributionId)
      .single();

    if (!error && contribution?.status === 'paid') {
      console.log('✅ Payment confirmed in database!');
      return {
        success: true,
        status: 'paid',
        message: 'Payment confirmed'
      };
    }

    // If still pending after 3 attempts, trigger manual verification
    if (attempt >= 3) {
      console.log('⏰ Triggering manual verification...');
      const verificationResult = await verifyContributionPayment(contributionId);
      
      if (verificationResult.status === 'paid') {
        return verificationResult;
      }
    }

    // Wait before next attempt (unless it's the last one)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  console.log('⏰ Polling timeout - payment not confirmed');
  return {
    success: false,
    status: 'pending',
    message: 'Payment verification timed out. Please refresh the page.'
  };
}
