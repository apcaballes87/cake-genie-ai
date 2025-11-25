import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  customerEmail?: string;
  customerName?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface CreatePaymentResponse {
  success: boolean;
  paymentUrl: string;
  invoiceId: string;
  expiresAt: string;
  error?: string;
}

export async function createXenditPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse> {
  try {
    // Get the current session to include auth token
    const { data: { session } } = await supabase.auth.getSession();

    // Get payment mode from localStorage (test or live)
    const paymentMode = (typeof window !== 'undefined' && localStorage.getItem('xendit_payment_mode')) || 'test';

    // Dynamically construct redirect URLs based on the current domain.
    // This fixes the issue where deployed apps would fail on payment redirects.
    const domain = window.location.origin;
    const successUrl = `${domain}/#/order-confirmation?order_id=${params.orderId}`;
    const failureUrl = `${domain}/#/cart?payment_failed=true&order_id=${params.orderId}`;

    const bodyWithUrls = {
      ...params,
      success_redirect_url: successUrl,
      failure_redirect_url: failureUrl,
      payment_mode: paymentMode, // Send payment mode to edge function
    };

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('create-xendit-payment', {
      body: bodyWithUrls,
      headers: session ? {
        Authorization: `Bearer ${session.access_token}`
      } : {}
    });

    if (error) {
      console.error('Error creating Xendit payment:', error);
      throw new Error(error.message || 'Failed to create payment');
    }

    if (!data.success) {
      throw new Error(data.error || 'Payment creation failed');
    }

    return data;
  } catch (error) {
    console.error('createXenditPayment error:', error);
    throw error;
  }
}

export async function getPaymentStatus(orderId: string) {
  try {
    const { data, error } = await supabase
      .from('xendit_payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Gracefully handle not found error which is expected before webhook confirmation
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching payment status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('getPaymentStatus error:', error);
    return null;
  }
}

/**
 * Proactively verifies payment status by invoking a server-side Edge Function.
 * This function asks Xendit for the latest invoice status and updates the DB.
 */
export async function verifyXenditPayment(orderId: string): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    // Get payment mode from localStorage (test or live)
    const paymentMode = (typeof window !== 'undefined' && localStorage.getItem('xendit_payment_mode')) || 'test';

    const { data, error } = await supabase.functions.invoke('verify-xendit-payment', {
      body: { orderId, payment_mode: paymentMode },
      headers: session ? {
        Authorization: `Bearer ${session.access_token}`
      } : {}
    });

    if (error) {
      throw new Error(error.message || 'Failed to verify payment status.');
    }

    return data;
  } catch (error) {
    console.error('verifyXenditPayment error:', error);
    // Return an error object so the UI can handle it gracefully without crashing
    return { success: false, error: (error as Error).message };
  }
}