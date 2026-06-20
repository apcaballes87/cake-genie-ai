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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');

    // --- Helper: Fetch invoice from Xendit ---
    const fetchInvoice = async (invoiceId: string) => {
      const response = await fetch(`${XENDIT_API_URL}/v2/invoices/${invoiceId}`, {
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
      const { data: contribution, error: dbError } = await supabaseAdmin
        .from('order_contributions')
        .select('xendit_payment_request_id, xendit_invoice_id, status')
        .eq('contribution_id', contributionId)
        .single();

      if (dbError) throw dbError;
      
      const invoiceId = contribution.xendit_invoice_id || contribution.xendit_payment_request_id;
      if (!contribution || !invoiceId) {
        throw new Error(`No contribution record found for ID: ${contributionId}`);
      }

      if (contribution.status === 'paid') {
        return new Response(JSON.stringify({ success: true, status: 'PAID', message: 'Status is already PAID.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const invoice = await fetchInvoice(invoiceId);
      const latestStatus = invoice.status;

      if (latestStatus === 'PAID' && contribution.status !== 'paid') {
        console.log(`Status for invoice ${invoiceId} is PAID. Updating database.`);

        const { error: updateError } = await supabaseAdmin
          .from('order_contributions')
          .update({
            status: 'paid',
            paid_at: invoice.paid_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('contribution_id', contributionId);

        if (updateError) throw updateError;

        // Force update order totals
        const { data: contributions, error: sumError } = await supabaseAdmin
          .from('order_contributions')
          .select('amount')
          .eq('order_id', contribution.order_id)
          .eq('status', 'paid');

        if (!sumError && contributions) {
          const totalCollected = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
          const { data: order } = await supabaseAdmin
            .from('cakegenie_orders')
            .select('total_amount, split_message')
            .eq('order_id', contribution.order_id)
            .single();

          if (order) {
            const isFullyFunded = totalCollected >= order.total_amount;
            const isDownpayment = order.split_message === 'downpayment_50';
            const updates: any = { amount_collected: totalCollected };
            if (isFullyFunded) {
              updates.payment_status = 'paid';
              updates.order_status = 'confirmed';
            } else if (isDownpayment && totalCollected >= (order.total_amount * 0.49)) {
              updates.payment_status = 'partial';
              updates.order_status = 'confirmed';
            }
            await supabaseAdmin.from('cakegenie_orders').update(updates).eq('order_id', contribution.order_id);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, status: latestStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- HANDLE STANDARD ORDER PAYMENT ---
    const { data: paymentRecord, error: dbError } = await supabaseAdmin
      .from('xendit_payments')
      .select('xendit_payment_request_id, xendit_invoice_id, status')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError) throw dbError;
    
    const invoiceId = paymentRecord.xendit_invoice_id || paymentRecord.xendit_payment_request_id;
    if (!paymentRecord || !invoiceId) {
      throw new Error(`No payment record found for orderId: ${orderId}`);
    }

    if (paymentRecord.status === 'PAID') {
      return new Response(JSON.stringify({ success: true, status: 'PAID', message: 'Status is already PAID.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const invoice = await fetchInvoice(invoiceId);
    const latestStatus = invoice.status;

    if (latestStatus === 'PAID' && paymentRecord.status !== 'PAID') {
      console.log(`Status for invoice ${invoiceId} is PAID. Updating database.`);

      const paymentMethod = invoice.payment_method || null;
      const paidAmount = invoice.paid_amount || invoice.amount;

      const { error: updatePaymentError } = await supabaseAdmin
        .from('xendit_payments')
        .update({
          status: 'PAID',
          payment_method: paymentMethod,
          paid_amount: paidAmount,
          paid_at: invoice.paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('xendit_invoice_id', invoiceId);
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

      if (Math.abs(paidAmount - order.total_amount) > 1.0) {
        console.error(`❌ Payment Mismatch! Received: ${paidAmount}, Expected: ${order.total_amount}`);
        await supabaseAdmin
          .from('cakegenie_orders')
          .update({
            payment_status: 'payment_mismatch',
            order_notes: `Payment Mismatch (Verification): Paid ${paidAmount}, Expected ${order.total_amount}`
          })
          .eq('order_id', orderId);

        return new Response(JSON.stringify({ success: true, status: 'PAYMENT_MISMATCH', message: 'Payment amount mismatch detected.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const { error: updateOrderError } = await supabaseAdmin
        .from('cakegenie_orders')
        .update({
          payment_status: 'paid',
          order_status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);
      if (updateOrderError) throw updateOrderError;

      // Defer cart clear: the RPC that created the order leaves the
      // cart intact on the server so abandoned checkouts can be
      // recovered. Clear it now that the order is paid. The helper is
      // idempotent (returns 0 on a second call) so it's safe even if
      // xendit-webhook also fires.
      try {
        const { data: clearedCount, error: clearError } = await supabaseAdmin
          .rpc('clear_cart_for_paid_order', { p_order_id: orderId });

        if (clearError) {
          console.error('⚠️  clear_cart_for_paid_order failed (non-fatal):', clearError);
        } else {
          console.log(`🛒 Cleared ${clearedCount ?? 0} cart row(s) for paid order ${orderId}`);
        }
      } catch (e) {
        // Never let a cart-clear hiccup roll back the order flip.
        console.error('⚠️  clear_cart_for_paid_order threw (non-fatal):', e);
      }
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
