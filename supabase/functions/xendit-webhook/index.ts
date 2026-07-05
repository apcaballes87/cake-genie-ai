import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mirrorOrderPurchaseToGa4 } from '../_shared/ga4MeasurementProtocol.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const roundCurrency = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

const toCurrencyCents = (value: number) => Math.round(Number(value) * 100);

const amountsMatch = (left: number, right: number) =>
    Math.abs(toCurrencyCents(left) - toCurrencyCents(right)) <= 1;

function getWebhookCallbackToken(): string | null {
    return (
        Deno.env.get('XENDIT_WEBHOOK_CALLBACK_TOKEN') ||
        Deno.env.get('XENDIT_CALLBACK_TOKEN') ||
        Deno.env.get('XENDIT_PAYMENT_CALLBACK_TOKEN') ||
        null
    );
}

async function clearCartForOrder(supabase: ReturnType<typeof createClient>, orderId: string) {
    try {
        const { data: clearedCount, error: clearError } = await supabase
            .rpc('clear_cart_for_paid_order', { p_order_id: orderId });

        if (clearError) {
            console.error('⚠️  clear_cart_for_paid_order failed (non-fatal):', clearError);
        } else {
            console.log(`🛒 Cleared ${clearedCount ?? 0} cart row(s) for funded order ${orderId}`);
        }
    } catch (error) {
        console.error('⚠️  clear_cart_for_paid_order threw (non-fatal):', error);
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const callbackToken = getWebhookCallbackToken();
        const receivedCallbackToken = req.headers.get('x-callback-token');

        if (callbackToken && receivedCallbackToken !== callbackToken) {
            console.error('❌ Invalid Xendit webhook callback token');
            return new Response(JSON.stringify({ success: false, error: 'Invalid webhook signature' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!callbackToken) {
            console.warn('⚠️  Xendit webhook token is not configured; webhook requests are not signature-verified.');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const ga4MeasurementId = Deno.env.get('GA4_MEASUREMENT_ID') ?? '';
        const ga4MeasurementProtocolApiSecret = Deno.env.get('GA4_MEASUREMENT_PROTOCOL_API_SECRET') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log('\n========== XENDIT WEBHOOK RECEIVED ==========');
        console.log('Method:', req.method);
        console.log('Headers:', Object.fromEntries(req.headers.entries()));

        const webhookData = await req.json();
        console.log('Payload:', JSON.stringify(webhookData, null, 2));

        const isV3 = webhookData.event && webhookData.event.startsWith('payment');
        let paymentRequestId: string | null = null;
        let externalId: string | null = null;
        let status: string | null = null;
        let capturedAmount: number | null = null;
        let paidAt: string | null = null;
        let paymentMethod: string | null = null;
        let paymentChannel: string | null = null;
        const rawData = webhookData;

        if (isV3) {
            const data = webhookData.data || webhookData;
            paymentRequestId = data.payment_request_id || data.id || null;
            externalId = data.reference_id || data.external_id || null;
            status = data.status || null;
            capturedAmount = Number(data.captured_amount ?? data.request_amount ?? data.amount ?? 0) || null;
            paidAt = data.captured_at || data.paid_at || null;
            paymentMethod = data.payment_method?.type || data.payment_method || null;
            paymentChannel = data.payment_method?.channel_code || data.payment_channel || null;

            console.log(`\n📌 V3 Webhook detected: ${webhookData.event}`);
            console.log(`Payment Request ID: ${paymentRequestId}`);
            console.log(`Status: ${status}`);
        } else {
            paymentRequestId = webhookData.id || null;
            externalId = webhookData.external_id || null;
            status = webhookData.status || null;
            capturedAmount = Number(webhookData.paid_amount ?? webhookData.amount ?? 0) || null;
            paidAt = webhookData.paid_at || null;
            paymentMethod = webhookData.payment_method || null;
            paymentChannel = webhookData.payment_channel || null;

            console.log('\n📌 V2 Webhook detected (invoice format)');
            console.log(`Invoice ID: ${paymentRequestId}`);
            console.log(`Status: ${status}`);
        }

        if (!externalId) {
            console.error('❌ No external_id in webhook payload');
            return new Response(JSON.stringify({ error: 'Missing external_id' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const paymentStatus = status === 'SUCCEEDED' || status === 'PAID'
            ? 'PAID'
            : status === 'EXPIRED' ? 'EXPIRED'
            : status === 'FAILED' || status === 'CANCELED' ? 'FAILED'
            : 'PENDING';

        console.log(`\n💳 Processing ${paymentStatus} payment`);
        console.log(`External ID: ${externalId}`);
        console.log(`Payment Request/Invoice ID: ${paymentRequestId}`);

        let contribution = null;

        if (paymentRequestId) {
            const { data: contribByReqId } = await supabase
                .from('order_contributions')
                .select('contribution_id, order_id, amount, status')
                .eq('xendit_payment_request_id', paymentRequestId)
                .single();

            if (contribByReqId) {
                contribution = contribByReqId;
            }
        }

        if (!contribution && paymentRequestId) {
            const { data: contribByInvoiceId } = await supabase
                .from('order_contributions')
                .select('contribution_id, order_id, amount, status')
                .eq('xendit_invoice_id', paymentRequestId)
                .single();

            if (contribByInvoiceId) {
                contribution = contribByInvoiceId;
            }
        }

        if (!contribution && paymentRequestId) {
            const { data: billContrib } = await supabase
                .from('bill_contributions')
                .select('contribution_id, order_id')
                .eq('xendit_invoice_id', paymentRequestId)
                .single();

            if (billContrib) {
                contribution = billContrib;
            }
        }

        if (contribution) {
            console.log('✅ Found linked contribution:', contribution.contribution_id);

            if (contribution.status === 'paid') {
                return new Response(JSON.stringify({ success: true, type: 'contribution', ignored: true }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (paymentStatus === 'PAID') {
                const paidAmount = Number(capturedAmount ?? 0);

                if (!amountsMatch(paidAmount, Number(contribution.amount ?? 0))) {
                    await supabase
                        .from('cakegenie_orders')
                        .update({
                            order_notes: `Contribution amount mismatch (webhook): Paid ${paidAmount}, Expected ${contribution.amount}`
                        })
                        .eq('order_id', contribution.order_id);

                    return new Response(JSON.stringify({ success: true, type: 'contribution', amountMismatch: true }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                await supabase
                    .from('order_contributions')
                    .update({
                        status: 'paid',
                        paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('contribution_id', contribution.contribution_id);

                const { data: updatedOrder } = await supabase
                    .from('cakegenie_orders')
                    .select(`
                        order_id,
                        order_number,
                        user_id,
                        total_amount,
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

                if (updatedOrder?.payment_status === 'paid' || updatedOrder?.payment_status === 'partial') {
                    await clearCartForOrder(supabase, contribution.order_id);
                    if (ga4MeasurementId && ga4MeasurementProtocolApiSecret) {
                        await mirrorOrderPurchaseToGa4({
                            supabaseAdmin: supabase,
                            order: updatedOrder,
                            measurementId: ga4MeasurementId,
                            apiSecret: ga4MeasurementProtocolApiSecret,
                        });
                    }
                }
            } else {
                await supabase
                    .from('order_contributions')
                    .update({
                        status: paymentStatus.toLowerCase(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('contribution_id', contribution.contribution_id)
                    .neq('status', 'paid');
            }

            return new Response(JSON.stringify({ success: true, type: 'contribution' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('\n🛒 ORDER PAYMENT DETECTED');

        let paymentRecord = null;

        if (paymentRequestId) {
            const { data: recordByReqId } = await supabase
                .from('xendit_payments')
                .select('order_id, amount, status')
                .eq('xendit_payment_request_id', paymentRequestId)
                .single();

            if (recordByReqId) {
                paymentRecord = recordByReqId;
            }
        }

        if (!paymentRecord && paymentRequestId) {
            const { data: recordByInvoiceId } = await supabase
                .from('xendit_payments')
                .select('order_id, amount, status')
                .eq('xendit_invoice_id', paymentRequestId)
                .single();

            if (recordByInvoiceId) {
                paymentRecord = recordByInvoiceId;
            }
        }

        if (!paymentRecord) {
            console.error('❌ No payment record found for ID:', paymentRequestId);
            return new Response(JSON.stringify({ error: 'No payment record found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (paymentRecord.status === 'PAID' && paymentStatus !== 'PAID') {
            console.log('ℹ️ Ignoring non-terminal webhook for an already-paid order.');
            return new Response(JSON.stringify({ success: true, type: 'order', ignored: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const paymentIdColumn =
            paymentRequestId && paymentRequestId.startsWith('pr-')
                ? 'xendit_payment_request_id'
                : 'xendit_invoice_id';

        const { error: updateError } = await supabase
            .from('xendit_payments')
            .update({
                status: paymentStatus,
                payment_method: paymentMethod,
                payment_channel: paymentChannel,
                paid_at: paidAt ? new Date(paidAt).toISOString() : null,
                webhook_data: rawData,
                paid_amount: capturedAmount
            })
            .eq(paymentIdColumn, paymentRequestId);

        if (updateError) {
            console.error('❌ Error updating payment:', updateError);
            throw updateError;
        }

        console.log('✅ Payment record updated');

        if (paymentStatus === 'PAID' && paymentRecord?.order_id) {
            const { data: order, error: orderError } = await supabase
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
                .eq('order_id', paymentRecord.order_id)
                .single();

            if (orderError || !order) {
                console.error('❌ Could not fetch order to verify amount:', orderError);
                throw new Error('Order verification failed');
            }

            const receivedAmount = Number(capturedAmount ?? paymentRecord.amount ?? 0);
            const orderTotal = Number(order.total_amount);

            console.log(`Verifying Payment: Received ${receivedAmount}, Order Total ${orderTotal}`);

            if (!amountsMatch(receivedAmount, orderTotal)) {
                console.error(`❌ Payment Mismatch! Received: ${receivedAmount}, Expected: ${orderTotal}`);

                await supabase
                    .from('cakegenie_orders')
                    .update({
                        payment_status: 'payment_mismatch',
                        order_notes: `Payment Mismatch: Paid ${receivedAmount}, Expected ${orderTotal}`
                    })
                    .eq('order_id', paymentRecord.order_id);

                return new Response(JSON.stringify({ success: true, message: 'Payment mismatch detected' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            await supabase
                .from('cakegenie_orders')
                .update({
                    order_status: 'confirmed',
                    payment_status: 'paid',
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', paymentRecord.order_id);

            console.log(`✅ Order ${paymentRecord.order_id} marked as confirmed`);
            await clearCartForOrder(supabase, paymentRecord.order_id);
            if (ga4MeasurementId && ga4MeasurementProtocolApiSecret) {
                await mirrorOrderPurchaseToGa4({
                    supabaseAdmin: supabase,
                    order: {
                        ...order,
                        ga_purchase_mirrored_at: order.ga_purchase_mirrored_at ?? null,
                    },
                    measurementId: ga4MeasurementId,
                    apiSecret: ga4MeasurementProtocolApiSecret,
                });
            }
        }

        console.log('\n========== WEBHOOK PROCESSING COMPLETE ==========\n');
        return new Response(JSON.stringify({ success: true, type: 'order' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('\n========== WEBHOOK ERROR ==========');
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        if (error instanceof Error && error.stack) {
            console.error('Stack:', error.stack);
        }
        console.error('====================================\n');

        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Webhook processing failed'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
