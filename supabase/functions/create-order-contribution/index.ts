import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const toCurrencyCents = (value: number) => Math.round(Number(value) * 100);

const amountsMatch = (left: number, right: number) =>
  Math.abs(toCurrencyCents(left) - toCurrencyCents(right)) <= 1;

function appendContributionId(urlString: string, contributionId: string): string {
  const url = new URL(urlString);
  url.searchParams.set('contribution_id', contributionId);
  return url.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json();
    const {
      orderId,
      contributorName,
      contributorEmail,
      amount,
      success_redirect_url,
      failure_redirect_url,
      payment_mode
    } = requestBody;

    const requestedAmount = Number(amount);

    if (!orderId || !contributorEmail || !success_redirect_url || !failure_redirect_url) {
      throw new Error('Missing required fields: orderId, contributorEmail, success_redirect_url, failure_redirect_url');
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new Error('Contribution amount must be a positive number.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not set.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

    let callerUserId: string | null = null;
    if (bearerToken) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (authError) {
        throw new Error('Unable to verify the current user session.');
      }
      callerUserId = authData.user?.id ?? null;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('cakegenie_orders')
      .select('total_amount, amount_collected, is_split_order, order_status, order_number, organizer_user_id, split_message, payment_status')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (!order.is_split_order) {
      throw new Error('This is not a split order');
    }

    if (order.order_status === 'cancelled') {
      throw new Error('Order is cancelled');
    }

    const orderTotal = Number(order.total_amount || 0);
    const currentCollected = Number(order.amount_collected || 0);
    const remaining = roundCurrency(orderTotal - currentCollected);

    if (order.payment_status === 'paid' || remaining <= 0) {
      throw new Error('Order is already fully funded');
    }

    const isDownpaymentOrder = order.split_message === 'downpayment_50';
    let expectedAmount = requestedAmount;
    if (isDownpaymentOrder) {
      if (!callerUserId) {
        throw new Error('Please sign in to continue with this payment.');
      }

      if (!order.organizer_user_id || callerUserId !== order.organizer_user_id) {
        throw new Error('Only the order organizer can generate downpayment or balance invoices for this order.');
      }

      expectedAmount = currentCollected > 0
        ? remaining
        : roundCurrency(orderTotal / 2);

      if (!amountsMatch(requestedAmount, expectedAmount)) {
        const formattedAmount = expectedAmount.toFixed(2);
        throw new Error(
          currentCollected > 0
            ? `The remaining balance must be paid in full (PHP ${formattedAmount}).`
            : `The required downpayment is exactly 50% of the order total (PHP ${formattedAmount}).`
        );
      }
    } else if (requestedAmount > remaining) {
      throw new Error(`Contribution amount (${requestedAmount}) exceeds remaining balance (${remaining})`);
    }

    const mode = payment_mode || 'test';
    const XENDIT_SECRET_KEY = mode === 'live'
      ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
      : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));

    if (!XENDIT_SECRET_KEY) {
      throw new Error(`Xendit API Key for ${mode} mode is not set.`);
    }

    if (isDownpaymentOrder) {
      const { data: existingContribution, error: existingContributionError } = await supabaseAdmin
        .from('order_contributions')
        .select('contribution_id, payment_url, xendit_invoice_id, xendit_payment_request_id')
        .eq('order_id', orderId)
        .eq('status', 'pending')
        .eq('amount', expectedAmount)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingContributionError) {
        throw new Error(`Failed to inspect existing contribution invoices: ${existingContributionError.message}`);
      }

      if (existingContribution?.payment_url) {
        return new Response(JSON.stringify({
          success: true,
          paymentUrl: existingContribution.payment_url,
          contributionId: existingContribution.contribution_id,
          paymentRequestId: existingContribution.xendit_invoice_id || existingContribution.xendit_payment_request_id,
          reusedExisting: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    const { data: contribution, error: contribError } = await supabaseAdmin
      .from('order_contributions')
      .insert({
        order_id: orderId,
        user_id: callerUserId,
        contributor_name: contributorName,
        contributor_email: contributorEmail,
        amount: requestedAmount,
        status: 'pending'
      })
      .select()
      .single();

    if (contribError || !contribution) {
      throw new Error('Failed to create contribution record: ' + contribError?.message);
    }

    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');
    const externalId = contribution.contribution_id;

    const xenditResponse = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': xenditAuthHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: requestedAmount,
        description: `Contribution for Order ${order.order_number}`.substring(0, 255),
        currency: 'PHP',
        customer: {
          given_names: contributorName || 'Contributor',
          email: contributorEmail
        },
        success_redirect_url: appendContributionId(success_redirect_url, externalId),
        failure_redirect_url: appendContributionId(failure_redirect_url, externalId)
      })
    });

    if (!xenditResponse.ok) {
      const err = await xenditResponse.text();
      throw new Error('Xendit error (' + xenditResponse.status + '): ' + err);
    }

    const invoice = await xenditResponse.json();

    const { error: updateError } = await supabaseAdmin
      .from('order_contributions')
      .update({
        xendit_invoice_id: invoice.id,
        xendit_payment_request_id: invoice.id,
        payment_url: invoice.invoice_url,
        updated_at: new Date().toISOString()
      })
      .eq('contribution_id', contribution.contribution_id);

    if (updateError) {
      throw new Error('Failed to update contribution record: ' + updateError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      paymentUrl: invoice.invoice_url,
      contributionId: contribution.contribution_id,
      paymentRequestId: invoice.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in create-order-contribution:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order contribution.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
