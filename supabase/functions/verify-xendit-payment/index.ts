import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

const XENDIT_API_URL = 'https://api.xendit.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, contributionId, payment_mode } = await req.json();

    if (!orderId && !contributionId) {
      throw new Error('orderId or contributionId is required in the request body.');
    }

    const mode = payment_mode || 'test';
    const XENDIT_SECRET_KEY = mode === 'live'
      ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
      : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));

    if (!XENDIT_SECRET_KEY) {
      throw new Error(`Xendit API Key for ${mode} mode is not set.`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not set.');
    }

    // Use the Service Role Key to bypass RLS for server-to-server operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');

    // --- Helper: Map v3 status to internal status ---
    const mapStatus = (v3Status: string): string => {
      switch (v3Status) {
        case 'SUCCEEDED': return 'PAID';
        case 'EXPIRED': return 'EXPIRED';
        case 'FAILED': return 'FAILED';
        case 'CANCELED': return 'FAILED';
        case 'PENDING': return 'PENDING';
        default: return v3Status;
      }
    };

    // --- Helper: Fetch payment request from Xendit ---
    const fetchPaymentRequest = async (paymentRequestId: string) => {
      const response = await fetch(`${XENDIT_API_URL}/v2/payment_requests/${paymentRequestId}`, {
        method: 'GET',
        headers: { 'Authorization': xenditAuthHeader },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Xendit API error: ${response.status} ${errorBody}`);
      }

      return await response.json();
    };

    // --- HANDLE CONTRIBUTION PAYMENT ---
    if (contributionId) {
      // Try payment_request_id first, fall back to invoice_id for backward compat
      const { data: contribution, error: dbError } = await supabaseAdmin
        .from('order_contributions')
        .select('xendit_payment_request_id, xendit_invoice_id, status')
        .eq('contribution_id', contributionId)
        .single();

      if (dbError) throw dbError;
      
      const paymentRequestId = contribution.xendit_payment_request_id || contribution.xendit_invoice_id;
      if (!contribution || !paymentRequestId) {
        throw new Error(`No contribution record found for ID: ${contributionId}`);
      }

      if (contribution.status === 'paid') {
        return new Response(JSON.stringify({ success: true, status: 'PAID', message: 'Status is already PAID.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const paymentRequest = await fetchPaymentRequest(paymentRequestId);
      const latestStatus = mapStatus(paymentRequest.status);

      if (latestStatus === 'PAID') {
        if (contribution.status !== 'paid') {
          console.log(`Status for contribution ${paymentRequestId} is SUCCEEDED. Updating database.`);

          const { error: updateError } = await supabaseAdmin
            .from('order_contributions')
            .update({
              status: 'paid',
              paid_at: paymentRequest.captured_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('contribution_id', contributionId);

          if (updateError) throw updateError;
        }

        // Force update order totals to ensure consistency (self-healing)
        const { data: contributions, error: sumError } = await supabaseAdmin
          .from('order_contributions')
          .select('amount')
          .eq('order_id', contribution.order_id)
          .eq('status', 'paid');

        if (!sumError && contributions) {
          const totalCollected = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);

          const { data: order } = await supabaseAdmin
            .from('cakegenie_orders')
            .select('total_amount')
            .eq('order_id', contribution.order_id)
            .single();

          if (order) {
            const isFullyFunded = totalCollected >= order.total_amount;
            const updates: any = { amount_collected: totalCollected };

            if (isFullyFunded) {
              updates.payment_status = 'paid';
              updates.order_status = 'confirmed';
            }

            await supabaseAdmin
              .from('cakegenie_orders')
              .update(updates)
              .eq('order_id', contribution.order_id);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, status: latestStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- HANDLE STANDARD ORDER PAYMENT ---
    // 1. Get the payment_request_id from database using orderId
    const { data: paymentRecord, error: dbError } = await supabaseAdmin
      .from('xendit_payments')
      .select('xendit_payment_request_id, xendit_invoice_id, status')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError) throw dbError;
    
    const paymentRequestId = paymentRecord.xendit_payment_request_id || paymentRecord.xendit_invoice_id;
    if (!paymentRecord || !paymentRequestId) {
      throw new Error(`No payment record found for orderId: ${orderId}`);
    }

    // If status is already PAID, no need to check again.
    if (paymentRecord.status === 'PAID') {
      return new Response(JSON.stringify({ success: true, status: 'PAID', message: 'Status is already PAID.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Call Xendit's Payment Request API to get the latest status
    const paymentRequest = await fetchPaymentRequest(paymentRequestId);
    const latestStatus = mapStatus(paymentRequest.status);

    // 3. If the status has changed to PAID, update your database
    if (latestStatus === 'PAID' && paymentRecord.status !== 'PAID') {
      console.log(`Status for payment request ${paymentRequestId} is SUCCEEDED. Updating database.`);

      // Extract payment details from the v3 response
      const paymentMethodType = paymentRequest.payment_method?.type || null;
      const paymentMethod = paymentRequest.payment_method?.display_name || paymentMethodType;
      const capturedAmount = paymentRequest.captured_amount || paymentRequest.amount;

      // Update xendit_payments to record the raw data
      const { error: updatePaymentError } = await supabaseAdmin
        .from('xendit_payments')
        .update({
          status: 'PAID',
          payment_method: paymentMethod,
          paid_amount: capturedAmount,
          paid_at: paymentRequest.captured_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('xendit_payment_request_id', paymentRequestId);
      if (updatePaymentError) throw updatePaymentError;

      // --- SECURITY CHECK: VERIFY AMOUNT ---
      const { data: order, error: orderError } = await supabaseAdmin
        .from('cakegenie_orders')
        .select('total_amount')
        .eq('order_id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error(`Could not fetch order to verify amount for orderId: ${orderId}`);
      }

      const paidAmount = capturedAmount || paymentRequest.amount;
      const orderTotal = order.total_amount;

      // Allow for small floating point differences
      if (Math.abs(paidAmount - orderTotal) > 1.0) {
        console.error(`❌ Payment Mismatch in Verification! Received: ${paidAmount}, Expected: ${orderTotal}`);

        await supabaseAdmin
          .from('cakegenie_orders')
          .update({
            payment_status: 'payment_mismatch',
            order_notes: `Payment Mismatch (Verification): Paid ${paidAmount}, Expected ${orderTotal}`
          })
          .eq('order_id', orderId);

        return new Response(JSON.stringify({ success: true, status: 'PAYMENT_MISMATCH', message: 'Payment amount mismatch detected.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // --- AMOUNT VERIFIED: PROCEED TO CONFIRM ---
      const { error: updateOrderError } = await supabaseAdmin
        .from('cakegenie_orders')
        .update({
          payment_status: 'paid',
          order_status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);
      if (updateOrderError) throw updateOrderError;
    }

    return new Response(JSON.stringify({ success: true, status: latestStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
