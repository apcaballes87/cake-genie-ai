import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// FIX: Add a declaration for the Deno global object to resolve TypeScript errors
// about 'env' property not existing. This helps the linter understand the Deno runtime environment.
declare const Deno: any;

// The Xendit Secret API Key should be set in your Supabase project's Edge Function environment variables.
const XENDIT_SECRET_KEY = Deno.env.get('XENDIT_SECRET_KEY');
const XENDIT_API_URL = 'https://api.xendit.co';

serve(async (req) => {
  console.log('=== DEBUG: Verify Xendit Payment Function Start ===');
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Handling main request');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Try to parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', requestBody);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON in request body' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { orderId } = requestBody;
    console.log('Extracted orderId:', orderId);
    
    if (!orderId) {
      console.log('orderId is missing from request body');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'orderId is required in the request body.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!XENDIT_SECRET_KEY) {
      console.log('XENDIT_SECRET_KEY is not set');
      throw new Error('XENDIT_SECRET_KEY is not set in environment variables.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.log('Supabase environment variables are not set');
      throw new Error('Supabase environment variables are not set.');
    }

    // Use the Service Role Key to bypass RLS for server-to-server operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get the invoice_id from your database using the orderId
    console.log(`Fetching payment record for orderId: ${orderId}`);
    
    const { data: paymentRecord, error: dbError } = await supabaseAdmin
      .from('xendit_payments')
      .select('xendit_invoice_id, status')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError) {
      console.error(`Database error when fetching payment record for orderId ${orderId}:`, dbError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Database error: ${dbError.message}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    if (!paymentRecord || !paymentRecord.xendit_invoice_id) {
      console.error(`No payment record found for orderId: ${orderId}`, paymentRecord);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `No payment record found for orderId: ${orderId}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Found payment record:', paymentRecord);

    // If status is already PAID, no need to check again.
    if (paymentRecord.status === 'PAID') {
      console.log('Payment is already PAID, returning early');
      return new Response(JSON.stringify({ 
        success: true, 
        status: 'PAID', 
        message: 'Status is already PAID.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    const invoiceId = paymentRecord.xendit_invoice_id;
    console.log('Invoice ID to check:', invoiceId);

    // 2. Call Xendit's API to get the latest invoice status
    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');
    console.log('Calling Xendit API for invoice:', invoiceId);
    
    const xenditResponse = await fetch(`${XENDIT_API_URL}/v2/invoices/${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': xenditAuthHeader,
      },
    });

    if (!xenditResponse.ok) {
      const errorBody = await xenditResponse.text();
      console.error('Xendit API error:', xenditResponse.status, errorBody);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Xendit API error: ${xenditResponse.status} ${errorBody}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const invoice = await xenditResponse.json();
    console.log('Xendit API response:', invoice);
    
    const latestStatus = invoice.status;
    console.log('Latest status from Xendit:', latestStatus);

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
        
      if (updatePaymentError) {
        console.error('Error updating payment record:', updatePaymentError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Error updating payment record: ${updatePaymentError.message}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      // Also update the main order table
      const { error: updateOrderError } = await supabaseAdmin
        .from('cakegenie_orders')
        .update({ payment_status: 'paid' })
        .eq('order_id', orderId);
        
      if (updateOrderError) {
        console.error('Error updating order record:', updateOrderError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Error updating order record: ${updateOrderError.message}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    console.log('Returning success response with status:', latestStatus);
    return new Response(JSON.stringify({ 
      success: true, 
      status: latestStatus 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('=== DEBUG: Unhandled error in verify function ===', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
