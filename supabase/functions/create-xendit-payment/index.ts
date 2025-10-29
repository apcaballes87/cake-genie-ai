import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers directly instead of importing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Get the user ID from the authorization header
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Verify the token and get user info
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error) {
          console.warn('Failed to get user from token:', error);
        } else {
          userId = user.id;
        }
      } catch (tokenError) {
        console.warn('Failed to verify token:', tokenError);
      }
    }

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
    const paymentRecord = {
      order_id: orderId,
      xendit_invoice_id: invoice.id,
      xendit_external_id: orderId,
      user_id: userId,
      status: invoice.status,
      amount: amount,
      payment_link_url: invoice.invoice_url,
      expiry_date: invoice.expiry_date,
      created_at: new Date().toISOString(),
    };
    
    console.log('Attempting to insert payment record:', paymentRecord);
    
    const { error: insertError } = await supabaseAdmin
      .from('xendit_payments')
      .insert(paymentRecord);

    if (insertError) {
      console.error('Error storing payment record:', insertError);
      // Log the table structure for debugging
      const { data: tableInfo, error: tableError } = await supabaseAdmin
        .from('xendit_payments')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error('Error querying xendit_payments table structure:', tableError);
      } else {
        console.log('xendit_payments table sample data:', tableInfo);
      }
      
      throw insertError;
    }

    return new Response(JSON.stringify({
      success: true,
      paymentUrl: invoice.invoice_url,
      xenditInvoiceId: invoice.id,
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
