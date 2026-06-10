// supabase/functions/verify-contribution-payment/index.ts

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase environment variables are not set.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { contributionId, payment_mode } = await req.json();
    if (!contributionId) {
      throw new Error('contributionId is required in the request body.');
    }

    const mode = payment_mode || 'test';
    const XENDIT_SECRET_KEY = mode === 'live'
      ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
      : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));

    if (!XENDIT_SECRET_KEY) {
        throw new Error(`Xendit API Key for ${mode} mode is not set.`);
    }

    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');

    // 1. Get the payment_request_id from bill_contributions table
    const { data: contributionRecord, error: dbError } = await supabaseAdmin
      .from('bill_contributions')
      .select('xendit_payment_request_id, xendit_invoice_id, status')
      .eq('contribution_id', contributionId)
      .single();

    if (dbError) throw dbError;

    const paymentRequestId = contributionRecord.xendit_payment_request_id || contributionRecord.xendit_invoice_id;
    if (!contributionRecord || !paymentRequestId) {
      throw new Error(`No payment record found for contributionId: ${contributionId}`);
    }

    if (contributionRecord.status === 'paid') {
        return new Response(JSON.stringify({ success: true, status: 'paid', message: 'Contribution is already paid.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // 2. Call Xendit's Payment Request API
    const xenditResponse = await fetch(`${XENDIT_API_URL}/v2/payment_requests/${paymentRequestId}`, {
      method: 'GET',
      headers: { 'Authorization': xenditAuthHeader },
    });

    if (!xenditResponse.ok) {
      const errorBody = await xenditResponse.text();
      throw new Error(`Xendit API error: ${xenditResponse.status} ${errorBody}`);
    }

    const paymentRequest = await xenditResponse.json();

    // Map v3 status to internal status
    const latestStatus = paymentRequest.status === 'SUCCEEDED' ? 'paid'
      : paymentRequest.status === 'EXPIRED' ? 'expired'
      : paymentRequest.status === 'FAILED' || paymentRequest.status === 'CANCELED' ? 'failed'
      : 'pending';

    // 3. Update database if status changed to paid
    if (latestStatus === 'paid' && contributionRecord.status !== 'paid') {
        console.log(`Status for payment request ${paymentRequestId} is SUCCEEDED. Updating database.`);

        const { error: updateError } = await supabaseAdmin
            .from('bill_contributions')
            .update({ 
                status: 'paid', 
                paid_at: paymentRequest.captured_at || new Date().toISOString(),
            })
            .eq('contribution_id', contributionId);
        if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({ success: true, status: latestStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, status: 'pending', error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
