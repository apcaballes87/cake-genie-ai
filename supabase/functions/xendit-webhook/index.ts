import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Log all incoming requests
        console.log('\n========== XENDIT WEBHOOK RECEIVED ==========');
        console.log('Method:', req.method);
        console.log('Headers:', Object.fromEntries(req.headers.entries()));

        const webhookData = await req.json();
        console.log('Payload:', JSON.stringify(webhookData, null, 2));

        // --- Detect webhook format (v2 Invoice vs v3 Payment Request) ---
        // v2 Invoice webhook: { id, external_id, status, paid_amount, ... }
        // v3 Payment Request webhook: { id, external_id, status, data: { ... } }
        // v3 also has event field like "payment_request.updated" or "payment.capture"

        const isV3 = webhookData.event && webhookData.event.startsWith('payment');
        let paymentRequestId: string | null = null;
        let externalId: string | null = null;
        let status: string | null = null;
        let capturedAmount: number | null = null;
        let paidAt: string | null = null;
        let paymentMethod: string | null = null;
        let paymentChannel: string | null = null;
        let rawData = webhookData;

        if (isV3) {
            // v3 Payment Request webhook format
            // Payload: { event, api_version, data: { payment_request_id, reference_id, status, ... } }
            const data = webhookData.data || webhookData;
            paymentRequestId = data.payment_request_id || data.id || null;
            externalId = data.reference_id || data.external_id || null; // v3 uses reference_id
            status = data.status || null;
            capturedAmount = data.captured_amount || data.amount || null;
            paidAt = data.captured_at || data.paid_at || null;
            paymentMethod = data.payment_method?.type || data.payment_method || null;
            paymentChannel = data.payment_method?.channel_code || data.payment_channel || null;

            console.log(`\n📌 V3 Webhook detected: ${webhookData.event}`);
            console.log(`Payment Request ID: ${paymentRequestId}`);
            console.log(`Status: ${status}`);
        } else {
            // v2 Invoice webhook format (backward compat)
            paymentRequestId = webhookData.id || null;
            externalId = webhookData.external_id || null;
            status = webhookData.status || null;
            capturedAmount = webhookData.paid_amount || webhookData.amount || null;
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

        // Map v3 status to internal status
        const paymentStatus = status === 'SUCCEEDED' || status === 'PAID'
            ? 'PAID'
            : status === 'EXPIRED' ? 'EXPIRED'
            : status === 'FAILED' || status === 'CANCELED' ? 'FAILED'
            : 'PENDING';

        console.log(`\n💳 Processing ${paymentStatus} payment`);
        console.log(`External ID: ${externalId}`);
        console.log(`Payment Request/Invoice ID: ${paymentRequestId}`);

        // Check if this is a contribution payment first
        // Try xendit_payment_request_id first, then xendit_invoice_id for backward compat
        let contribution = null;
        
        if (paymentRequestId) {
            const { data: contribByReqId } = await supabase
                .from('order_contributions')
                .select('contribution_id, order_id')
                .eq('xendit_payment_request_id', paymentRequestId)
                .single();
            
            if (contribByReqId) {
                contribution = contribByReqId;
            }
        }

        // Fallback: try xendit_invoice_id
        if (!contribution && paymentRequestId) {
            const { data: contribByInvoiceId } = await supabase
                .from('order_contributions')
                .select('contribution_id, order_id')
                .eq('xendit_invoice_id', paymentRequestId)
                .single();
            
            if (contribByInvoiceId) {
                contribution = contribByInvoiceId;
            }
        }

        // Also try bill_contributions table (legacy)
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

            await supabase
                .from('order_contributions')
                .update({
                    status: paymentStatus === 'PAID' ? 'paid' : paymentStatus.toLowerCase(),
                    paid_at: paidAt ? new Date(paidAt).toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('contribution_id', contribution.contribution_id);

            return new Response(JSON.stringify({ success: true, type: 'contribution' }), { status: 200, headers: corsHeaders });
        }

        // If not a contribution, handle as ORDER
        console.log('\n🛒 ORDER PAYMENT DETECTED');

        // Try to find payment record by xendit_payment_request_id first, then xendit_invoice_id
        let paymentRecord = null;

        if (paymentRequestId) {
            const { data: recordByReqId } = await supabase
                .from('xendit_payments')
                .select('order_id, amount')
                .eq('xendit_payment_request_id', paymentRequestId)
                .single();
            
            if (recordByReqId) {
                paymentRecord = recordByReqId;
            }
        }

        // Fallback: try xendit_invoice_id
        if (!paymentRecord && paymentRequestId) {
            const { data: recordByInvoiceId } = await supabase
                .from('xendit_payments')
                .select('order_id, amount')
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
            .eq(paymentRequestId && paymentRequestId.startsWith('pr-')
                ? 'xendit_payment_request_id'
                : 'xendit_invoice_id', paymentRequestId);

        if (updateError) {
            console.error('❌ Error updating payment:', updateError);
            throw updateError;
        }

        console.log('✅ Payment record updated');

        if (paymentStatus === 'PAID') {
            if (paymentRecord?.order_id) {
                // --- SECURITY FIX: VERIFY AMOUNT ---
                const { data: order, error: orderError } = await supabase
                    .from('cakegenie_orders')
                    .select('total_amount')
                    .eq('order_id', paymentRecord.order_id)
                    .single();

                if (orderError || !order) {
                    console.error('❌ Could not fetch order to verify amount:', orderError);
                    throw new Error('Order verification failed');
                }

                const receivedAmount = capturedAmount || paymentRecord.amount;
                const orderTotal = order.total_amount;

                console.log(`Verifying Payment: Received ${receivedAmount}, Order Total ${orderTotal}`);

                if (Math.abs(receivedAmount - orderTotal) > 1.0) {
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

                // Defer cart clear: the RPC that created the order leaves
                // the cart intact on the server so abandoned checkouts can
                // be recovered. Clear it now that the order is paid.
                // The helper is idempotent (returns 0 on a second call) so
                // it's safe even if verify-xendit-payment also fires.
                try {
                    const { data: clearedCount, error: clearError } = await supabase
                        .rpc('clear_cart_for_paid_order', { p_order_id: paymentRecord.order_id });

                    if (clearError) {
                        console.error('⚠️  clear_cart_for_paid_order failed (non-fatal):', clearError);
                    } else {
                        console.log(`🛒 Cleared ${clearedCount ?? 0} cart row(s) for paid order ${paymentRecord.order_id}`);
                    }
                } catch (e) {
                    // Never let a cart-clear hiccup roll back the order flip.
                    console.error('⚠️  clear_cart_for_paid_order threw (non-fatal):', e);
                }
            }
        }

        console.log('\n========== WEBHOOK PROCESSING COMPLETE ==========\n');
        return new Response(JSON.stringify({ success: true, type: 'order' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('\n========== WEBHOOK ERROR ==========');
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('====================================\n');

        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
