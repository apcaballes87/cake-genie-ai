import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { mirrorOrderPurchaseToGa4 } from '../_shared/ga4MeasurementProtocol.ts'

declare const Deno: any;

const XENDIT_API_URL = 'https://api.xendit.co';

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const toCurrencyCents = (value: number) => Math.round(Number(value) * 100);

const amountsMatch = (left: number, right: number) =>
  Math.abs(toCurrencyCents(left) - toCurrencyCents(right)) <= 1;

const mapStatus = (status: string): string => {
  switch (status) {
    case 'PAID':
      return 'PAID';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'FAILED':
    case 'CANCELED':
      return 'FAILED';
    case 'PENDING':
      return 'PENDING';
    default:
      return status;
  }
};

async function clearCartForOrder(supabaseAdmin: ReturnType<typeof createClient>, orderId: string) {
  try {
    const { count: sourceCount, error: sourceCountError } = await supabaseAdmin
      .from('cakegenie_order_items')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .not('source_cart_item_id', 'is', null);

    const { data: clearedCount, error: clearError } = await supabaseAdmin
      .rpc('clear_cart_for_paid_order', { p_order_id: orderId });

    if (clearError) {
      console.error('⚠️  clear_cart_for_paid_order failed (non-fatal):', clearError);
    } else {
      console.log('cart_paid_clear', {
        deleted_count: clearedCount ?? 0,
        source_count: sourceCountError ? null : sourceCount ?? 0,
      });
    }
  } catch (error) {
    console.error('⚠️  clear_cart_for_paid_order threw (non-fatal):', error);
  }
}

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
    const ga4MeasurementId = Deno.env.get('GA4_MEASUREMENT_ID') ?? '';
    const ga4MeasurementProtocolApiSecret = Deno.env.get('GA4_MEASUREMENT_PROTOCOL_API_SECRET') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not set.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');

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

    if (contributionId) {
      const { data: contribution, error: dbError } = await supabaseAdmin
        .from('order_contributions')
        .select('order_id, amount, status, xendit_payment_request_id, xendit_invoice_id')
        .eq('contribution_id', contributionId)
        .single();

      if (dbError || !contribution) {
        throw dbError || new Error(`No contribution record found for ID: ${contributionId}`);
      }

      const invoiceId = contribution.xendit_invoice_id || contribution.xendit_payment_request_id;
      if (!invoiceId) {
        throw new Error(`No contribution payment record found for ID: ${contributionId}`);
      }

      if (contribution.status === 'paid') {
        return new Response(JSON.stringify({ success: true, status: 'PAID', message: 'Status is already PAID.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const invoice = await fetchInvoice(invoiceId);
      const latestStatus = mapStatus(invoice.status);

      if (latestStatus !== 'PAID') {
        if (contribution.status !== latestStatus.toLowerCase()) {
          await supabaseAdmin
            .from('order_contributions')
            .update({
              status: latestStatus.toLowerCase(),
              updated_at: new Date().toISOString()
            })
            .eq('contribution_id', contributionId)
            .neq('status', 'paid');
        }

        return new Response(JSON.stringify({ success: true, status: latestStatus }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const paidAmount = Number(invoice.paid_amount ?? invoice.amount ?? 0);
      if (!amountsMatch(paidAmount, Number(contribution.amount ?? 0))) {
        await supabaseAdmin
          .from('cakegenie_orders')
          .update({
            order_notes: `Contribution amount mismatch (verification): Paid ${paidAmount}, Expected ${contribution.amount}`
          })
          .eq('order_id', contribution.order_id);

        return new Response(JSON.stringify({
          success: true,
          status: 'PAYMENT_MISMATCH',
          message: 'Contribution amount mismatch detected.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from('order_contributions')
        .update({
          status: 'paid',
          paid_at: invoice.paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('contribution_id', contributionId);

      if (updateError) throw updateError;

      const { data: contributions, error: sumError } = await supabaseAdmin
        .from('order_contributions')
        .select('amount')
        .eq('order_id', contribution.order_id)
        .eq('status', 'paid');

      if (!sumError && contributions) {
        const totalCollected = roundCurrency(
          contributions.reduce((sum, item) => sum + Number(item.amount || 0), 0)
        );
        const { data: order } = await supabaseAdmin
          .from('cakegenie_orders')
          .select(`
            order_id,
            order_number,
            user_id,
            total_amount,
            split_message,
            payment_status,
            discount_code_id,
            buyer_attribution,
            ga_purchase_mirrored_at,
            cakegenie_order_items (
              cake_type,
              cake_size,
              final_price,
              quantity
            )
          `)
          .eq('order_id', contribution.order_id)
          .single();

        if (order) {
          const requiredDownpayment = roundCurrency(Number(order.total_amount) / 2);
          const updates: Record<string, unknown> = { amount_collected: totalCollected };

          if (totalCollected >= Number(order.total_amount)) {
            updates.payment_status = 'paid';
            updates.order_status = 'confirmed';
          } else if (
            order.split_message === 'downpayment_50' &&
            totalCollected >= requiredDownpayment
          ) {
            updates.payment_status = 'partial';
            updates.order_status = 'confirmed';
          }

          await supabaseAdmin
            .from('cakegenie_orders')
            .update(updates)
            .eq('order_id', contribution.order_id);

          if (updates.payment_status === 'paid' || updates.payment_status === 'partial') {
            await clearCartForOrder(supabaseAdmin, contribution.order_id);
            if (ga4MeasurementId && ga4MeasurementProtocolApiSecret && order) {
              await mirrorOrderPurchaseToGa4({
                supabaseAdmin,
                order: {
                  ...order,
                  payment_status: String(updates.payment_status),
                },
                measurementId: ga4MeasurementId,
                apiSecret: ga4MeasurementProtocolApiSecret,
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, status: latestStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: paymentRecord, error: dbError } = await supabaseAdmin
      .from('xendit_payments')
      .select('xendit_payment_request_id, xendit_invoice_id, status')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError || !paymentRecord) {
      throw dbError || new Error(`No payment record found for orderId: ${orderId}`);
    }

    const invoiceId = paymentRecord.xendit_invoice_id || paymentRecord.xendit_payment_request_id;
    if (!invoiceId) {
      throw new Error(`No payment record found for orderId: ${orderId}`);
    }

    if (paymentRecord.status === 'PAID') {
      return new Response(JSON.stringify({ success: true, status: 'PAID', message: 'Status is already PAID.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const invoice = await fetchInvoice(invoiceId);
    const latestStatus = mapStatus(invoice.status);

    if (latestStatus === 'PAID' && paymentRecord.status !== 'PAID') {
      const paymentMethod = invoice.payment_method || null;
      const paidAmount = Number(invoice.paid_amount ?? invoice.amount ?? 0);
      const paymentIdColumn =
        paymentRecord.xendit_payment_request_id === invoiceId
          ? 'xendit_payment_request_id'
          : 'xendit_invoice_id';

      const { error: updatePaymentError } = await supabaseAdmin
        .from('xendit_payments')
        .update({
          status: 'PAID',
          payment_method: paymentMethod,
          paid_amount: paidAmount,
          paid_at: invoice.paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq(paymentIdColumn, invoiceId);
      if (updatePaymentError) throw updatePaymentError;

      const { data: order, error: orderError } = await supabaseAdmin
        .from('cakegenie_orders')
        .select(`
          order_id,
          order_number,
          user_id,
          total_amount,
          discount_code_id,
          buyer_attribution,
          ga_purchase_mirrored_at,
          cakegenie_order_items (
            cake_type,
            cake_size,
            final_price,
            quantity
          )
        `)
        .eq('order_id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error(`Could not fetch order to verify amount for orderId: ${orderId}`);
      }

      if (!amountsMatch(paidAmount, Number(order.total_amount))) {
        await supabaseAdmin
          .from('cakegenie_orders')
          .update({
            payment_status: 'payment_mismatch',
            order_notes: `Payment Mismatch (Verification): Paid ${paidAmount}, Expected ${order.total_amount}`
          })
          .eq('order_id', orderId);

        return new Response(JSON.stringify({
          success: true,
          status: 'PAYMENT_MISMATCH',
          message: 'Payment amount mismatch detected.'
        }), {
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

      await clearCartForOrder(supabaseAdmin, orderId);
      if (ga4MeasurementId && ga4MeasurementProtocolApiSecret) {
        await mirrorOrderPurchaseToGa4({
          supabaseAdmin,
          order: {
            ...order,
            ga_purchase_mirrored_at: order.ga_purchase_mirrored_at ?? null,
          },
          measurementId: ga4MeasurementId,
          apiSecret: ga4MeasurementProtocolApiSecret,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, status: latestStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify payment status.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
