import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// FIX: Add a declaration for the Deno global object to resolve TypeScript errors
// about 'env' property not existing. This helps the linter understand the Deno runtime environment.
declare const Deno: any;

// The Xendit Secret API Key should be set in your Supabase project's Edge Function environment variables.
const XENDIT_SECRET_KEY = Deno.env.get('XENDIT_SECRET_KEY');
const XENDIT_WEBHOOK_SIGNATURE = Deno.env.get('XENDIT_WEBHOOK_SIGNATURE');
const XENDIT_API_URL = 'https://api.xendit.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook signature if configured
    if (XENDIT_WEBHOOK_SIGNATURE) {
      const signature = req.headers.get('xendit-signature');
      if (signature !== XENDIT_WEBHOOK_SIGNATURE) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const payload = await req.json();
    console.log('[xendit-webhook] Received payload:', JSON.stringify(payload, null, 2));

    // Extract relevant data from the webhook payload
    const { id: invoiceId, external_id: externalId, status, paid_amount: paidAmount, paid_at: paidAt } = payload;

    // Validate required fields
    if (!invoiceId || !externalId || !status) {
      throw new Error('Missing required fields in webhook payload');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not set.');
    }

    // Use the Service Role Key to bypass RLS for server-to-server operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check if this is a contribution payment (contributions use contribution_id as external_id)
    if (externalId.startsWith('cont_')) {
      // Handle contribution payment
      await handleContributionPayment(
        supabaseAdmin,
        externalId,
        invoiceId,
        status,
        paidAmount,
        paidAt
      );
    } else {
      // Handle regular order payment
      await handleOrderPayment(
        supabaseAdmin,
        externalId,
        invoiceId,
        status,
        paidAmount,
        paidAt
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[xendit-webhook] Error processing webhook:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

async function handleContributionPayment(
  supabaseAdmin: any,
  contributionId: string,
  invoiceId: string,
  status: string,
  paidAmount: number,
  paidAt: string
) {
  console.log(`[xendit-webhook] Processing contribution payment: ${contributionId}`);
  
  // Update contribution status if payment is successful
  if (status === 'PAID') {
    // 1. Update the contribution record
    const { data: contribution, error: contributionError } = await supabaseAdmin
      .from('bill_contributions')
      .update({
        status: 'paid',
        paid_amount: paidAmount,
        paid_at: paidAt,
        updated_at: new Date().toISOString()
      })
      .eq('contribution_id', contributionId)
      .select('design_id, amount')
      .single();

    if (contributionError) {
      console.error('[xendit-webhook] Error updating contribution:', contributionError);
      throw contributionError;
    }

    if (!contribution) {
      throw new Error(`Contribution not found: ${contributionId}`);
    }

    console.log(`[xendit-webhook] Updated contribution ${contributionId} to paid`);

    // 2. Update the total amount collected for the design
    const { error: updateDesignError } = await supabaseAdmin.rpc(
      'update_design_amount_collected',
      { p_design_id: contribution.design_id }
    );

    if (updateDesignError) {
      console.error('[xendit-webhook] Error updating design amount collected:', updateDesignError);
      throw updateDesignError;
    }

    console.log(`[xendit-webhook] Updated amount collected for design: ${contribution.design_id}`);
  } else if (status === 'EXPIRED' || status === 'CANCELLED') {
    // Delete the contribution record if payment expired or was cancelled
    const { error: deleteError } = await supabaseAdmin
      .from('bill_contributions')
      .delete()
      .eq('contribution_id', contributionId);

    if (deleteError) {
      console.error('[xendit-webhook] Error deleting contribution:', deleteError);
      throw deleteError;
    }

    console.log(`[xendit-webhook] Deleted contribution ${contributionId} due to ${status}`);
  }
}

async function handleOrderPayment(
  supabaseAdmin: any,
  orderId: string,
  invoiceId: string,
  status: string,
  paidAmount: number,
  paidAt: string
) {
  console.log(`[xendit-webhook] Processing order payment: ${orderId}`);
  
  // Update order payment status if payment is successful
  if (status === 'PAID') {
    // 1. Update the payment record
    const { error: updatePaymentError } = await supabaseAdmin
      .from('xendit_payments')
      .update({
        status: 'PAID',
        paid_amount: paidAmount,
        paid_at: paidAt,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (updatePaymentError) {
      console.error('[xendit-webhook] Error updating payment record:', updatePaymentError);
      throw updatePaymentError;
    }

    // 2. Update the order status
    const { error: updateOrderError } = await supabaseAdmin
      .from('cakegenie_orders')
      .update({ payment_status: 'paid' })
      .eq('order_id', orderId);

    if (updateOrderError) {
      console.error('[xendit-webhook] Error updating order:', updateOrderError);
      throw updateOrderError;
    }

    console.log(`[xendit-webhook] Updated order ${orderId} to paid`);
  }
}