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

    const { orderId, amount, customerEmail, customerName, items, success_redirect_url, failure_redirect_url } = await req.json();

    if (!orderId || !amount) {
      throw new Error('orderId and amount are required.');
    }

    // Prepare Xendit invoice payload
    const invoicePayload = {
      external_id: orderId,
      amount: amount,
      payer_email: customerEmail,
      description: `Order ${orderId} - Cake Genie`,
      invoice_duration: 86400, // 24 hours
      success_redirect_url: success_redirect_url,
      failure_redirect_url: failure_redirect_url,
      currency: 'PHP',
      items: items || [],
      customer: customerName ? { given_names: customerName, email: customerEmail } : undefined,
    };

    // Create invoice via Xendit API
    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');
    const xenditResponse = await fetch(`${XENDIT_API_URL}/v2/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': xenditAuthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!xenditResponse.ok) {
      const errorBody = await xenditResponse.text();
      throw new Error(`Xendit API error: ${xenditResponse.status} ${errorBody}`);
    }

    const invoice = await xenditResponse.json();

    // Store payment record in database
    const { error: insertError } = await supabaseAdmin
      .from('xendit_payments')
      .insert({
        order_id: orderId,
        invoice_id: invoice.id,
        status: invoice.status,
        amount: amount,
        invoice_url: invoice.invoice_url,
        expiry_date: invoice.expiry_date,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error storing payment record:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({
      success: true,
      paymentUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      expiresAt: invoice.expiry_date,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error creating Xendit payment:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to create payment',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
