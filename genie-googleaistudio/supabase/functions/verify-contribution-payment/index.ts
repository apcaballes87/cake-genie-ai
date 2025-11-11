// supabase/functions/verify-contribution-payment/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

const XENDIT_SECRET_KEY = Deno.env.get('XENDIT_SECRET_KEY');
const XENDIT_API_URL = 'https://api.xendit.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!XENDIT_SECRET_KEY) {
        throw new Error('XENDIT_SECRET_KEY is not set in environment variables.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase environment variables are not set.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { contributionId } = await req.json();
    if (!contributionId) {
      throw new Error('contributionId is required in the request body.');
    }

    // 1. Get the invoice_id from bill_contributions table
    const { data: contributionRecord, error: dbError } = await supabaseAdmin
      .from('bill_contributions')
      .select('xendit_invoice_id, status')
      .eq('contribution_id', contributionId)
      .single();

    if (dbError) throw dbError;
    if (!contributionRecord || !contributionRecord.xendit_invoice_id) {
      throw new Error(`No payment record found for contributionId: ${contributionId}`);
    }

    if (contributionRecord.status === 'paid') {
        return new Response(JSON.stringify({ success: true, status: 'paid', message: 'Contribution is already paid.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    
    const invoiceId = contributionRecord.xendit_invoice_id;

    // 2. Call Xendit's API
    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');
    const xenditResponse = await fetch(`${XENDIT_API_URL}/v2/invoices/${invoiceId}`, {
      method: 'GET',
      headers: { 'Authorization': xenditAuthHeader },
    });

    if (!xenditResponse.ok) {
      const errorBody = await xenditResponse.text();
      throw new Error(`Xendit API error: ${xenditResponse.status} ${errorBody}`);
    }

    const invoice = await xenditResponse.json();
    const latestStatus = invoice.status.toLowerCase(); // PAID, PENDING, EXPIRED, FAILED

    // 3. Update database if status changed to paid
    if (latestStatus === 'paid' && contributionRecord.status !== 'paid') {
        console.log(`Status for invoice ${invoiceId} is PAID. Updating database.`);

        const { error: updateError } = await supabaseAdmin
            .from('bill_contributions')
            .update({ 
                status: 'paid', 
                paid_at: invoice.paid_at,
            })
            .eq('contribution_id', contributionId);
        if (updateError) throw updateError;
        
        // A database trigger on `bill_contributions` will handle updating `cakegenie_shared_designs`.
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
