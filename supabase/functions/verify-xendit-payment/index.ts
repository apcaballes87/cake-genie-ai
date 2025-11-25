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
    const { orderId, payment_mode } = await req.json();
    if (!orderId) {
      throw new Error('orderId is required in the request body.');
    }

    const mode = payment_mode || 'test';
    const XENDIT_SECRET_KEY = mode === 'live'
      ? Deno.env.get('XENDIT_LIVE_API_KEY')
      : Deno.env.get('XENDIT_TEST_API_KEY');

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

    // 1. Get the invoice_id from your database using the orderId
    const { data: paymentRecord, error: dbError } = await supabaseAdmin
      .from('xendit_payments')
      .select('xendit_invoice_id, status')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError) throw dbError;
    if (!paymentRecord || !paymentRecord.xendit_invoice_id) {
      throw new Error(`No payment record found for orderId: ${orderId}`);
    }

    // If status is already PAID, no need to check again.
    if (paymentRecord.status === 'PAID') {
      return new Response(JSON.stringify({ success: true, status: 'PAID', message: 'Status is already PAID.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const invoiceId = paymentRecord.xendit_invoice_id;

    // 2. Call Xendit's API to get the latest invoice status
    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');
    const xenditResponse = await fetch(`${XENDIT_API_URL}/v2/invoices/${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': xenditAuthHeader,
      },
    });

    if (!xenditResponse.ok) {
      const errorBody = await xenditResponse.text();
      throw new Error(`Xendit API error: ${xenditResponse.status} ${errorBody}`);
    }

    const invoice = await xenditResponse.json();
    const latestStatus = invoice.status;

    // 3. If the status has changed to PAID, update your database
    if (latestStatus === 'PAID' && paymentRecord.status !== 'PAID') {
      console.log(`Status for invoice ${invoiceId} is PAID. Updating database.`);

      const { error: updatePaymentError } = await supabaseAdmin
        .from('xendit_payments')
        .update({
          status: 'PAID',
          payment_method: invoice.payment_method,
          paid_amount: invoice.paid_amount,
          paid_at: invoice.paid_at,
          updated_at: new Date().toISOString()
        })
        .eq('xendit_invoice_id', invoiceId);
      if (updatePaymentError) throw updatePaymentError;

      // Also update the main order table
      const { error: updateOrderError } = await supabaseAdmin
        .from('cakegenie_orders')
        .update({ payment_status: 'paid' })
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