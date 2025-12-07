// services/paymentVerificationService.ts
import { getSupabaseClient } from '@/lib/supabase/client';

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


  for (let attempt = 1; attempt <= maxAttempts; attempt++) {


    // First check database
    const { data: contribution, error } = await supabase
      .from('bill_contributions')
      .select('status')
      .eq('contribution_id', contributionId)
      .single();

    if (!error && contribution?.status === 'paid') {

      return {
        success: true,
        status: 'paid',
        message: 'Payment confirmed'
      };
    }

    // If still pending after 3 attempts, trigger manual verification
    if (attempt >= 3) {

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


  return {
    success: false,
    status: 'pending',
    message: 'Payment verification timed out. Please refresh the page.'
  };
}
