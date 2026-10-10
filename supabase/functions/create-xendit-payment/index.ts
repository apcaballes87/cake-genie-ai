import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendOpenAIAdsOrderCreated } from '../_shared/openaiAdsConversions.ts'
import { getXenditSecretKey, resolvePaymentMode } from '../_shared/paymentMode.ts'

declare const Deno: any;

const jsonResponse = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
    });

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

        // The caller must be a signed-in user (guests are anonymous-auth users).
        // The function is deployed without gateway JWT verification, and the public
        // anon key is itself a valid JWT, so identify the user here.
        const accessToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
        const { data: authData, error: authError } = accessToken
            ? await supabaseAdmin.auth.getUser(accessToken)
            : { data: { user: null }, error: new Error('Missing access token') };
        const callerId = authData?.user?.id ?? null;
        if (authError || !callerId) {
            return jsonResponse({ success: false, error: 'Please sign in to pay for this order.' }, 401);
        }

        let requestBody;
        try {
            requestBody = await req.json();
        } catch (e) {
            console.error('Failed to parse request body:', e);
            throw new Error('Invalid request body: must be valid JSON');
        }
        console.log('Received request body:', JSON.stringify(requestBody, null, 2));

        const {
            orderId,
            success_redirect_url,
            failure_redirect_url,
            customerEmail,
            customerName,
            paymentTokenId
        } = requestBody || {};

        // Never taken from the request: see _shared/paymentMode.ts.
        const mode = resolvePaymentMode();

        console.log('Processing payment for Order ID:', orderId, 'payment_mode:', mode);

        // 1. Fetch Order from Database to get Trusted Amount
        const { data: order, error: orderError } = await supabaseAdmin
            .from('cakegenie_orders')
            .select(`
                order_id,
                total_amount,
                order_number,
                user_id,
                order_status,
                payment_status,
                subtotal,
                delivery_fee,
                discount_amount,
                discount_code_id,
                cakegenie_order_items (
                    cake_type,
                    quantity,
                    final_price,
                    customization_details
                )
            `)
            .eq('order_id', orderId)
            .single();

        if (orderError || !order) {
            console.error('Order not found or access denied:', orderError);
            throw new Error('Order not found');
        }

        // Only the order's owner may create a payment for it. Same message as a
        // missing order so order ids cannot be probed.
        if (order.user_id !== callerId) {
            console.error(`User ${callerId} tried to pay for order ${order.order_number} owned by someone else`);
            throw new Error('Order not found');
        }

        if (order.order_status === 'cancelled' || order.payment_status === 'paid' || order.payment_status === 'partial') {
            throw new Error('This order can no longer be paid online.');
        }

        const amount = Number(order.total_amount);
        console.log(`Order ${order.order_number} Total Amount: ${amount} (type: ${typeof amount})`);

        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error('Invalid order amount.');
        }

        // 2. Handle Free Orders (100% Discount)
        if (amount === 0) {
            // A zero total is only legitimate when a discount code covers the whole
            // order and the order's own lines add up to the subtotal. Anything else
            // (for example a tampered price) must not be auto-confirmed.
            const subtotal = Number(order.subtotal);
            const deliveryFee = Number(order.delivery_fee ?? 0);
            const discountAmount = Number(order.discount_amount ?? 0);
            const itemsSum = (order.cakegenie_order_items ?? []).reduce(
                (sum: number, item: any) => sum + Number(item.final_price) * Number(item.quantity),
                0,
            );
            const isFullyDiscounted =
                Boolean(order.discount_code_id) &&
                subtotal > 0 &&
                discountAmount > 0 &&
                discountAmount + 0.01 >= subtotal + deliveryFee &&
                Math.abs(itemsSum - subtotal) <= 0.01;

            if (!isFullyDiscounted) {
                console.error(`Refusing free order ${order.order_number}: zero total without a covering discount code.`);
                throw new Error('This order cannot be processed. Please contact support.');
            }

            console.log('Order is fully covered by a discount code. Marking as PAID.');

            const { error: updateError } = await supabaseAdmin
                .from('cakegenie_orders')
                .update({
                    payment_status: 'paid',
                    order_status: 'confirmed',
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', orderId);

            if (updateError) {
                console.error('Failed to update free order status:', updateError);
                throw new Error('Failed to process free order');
            }

            const adsResult = await sendOpenAIAdsOrderCreated({
                ...order,
                payment_status: 'paid',
            }, {
                pixelId: Deno.env.get('OPENAI_ADS_PIXEL_ID'),
                apiKey: Deno.env.get('OPENAI_ADS_CONVERSIONS_API_KEY'),
            });
            if (adsResult === 'failed') {
                console.warn('OpenAI Ads conversion reporting failed (non-fatal).');
            }

            return new Response(JSON.stringify({
                success: true,
                paymentUrl: success_redirect_url,
                paymentRequestId: 'FREE-' + orderId,
                isFree: true
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 3. Proceed with Xendit Invoice API for non-zero amounts
        const XENDIT_SECRET_KEY = getXenditSecretKey(mode);

        console.log('Using API key for mode:', mode, 'Key exists:', !!XENDIT_SECRET_KEY);

        if (!XENDIT_SECRET_KEY) {
            throw new Error(`Xendit API Key for ${mode} mode is not set.`);
        }

        // Fetch Order Details for Description
        const { data: orderData, error: orderDetailsError } = await supabaseAdmin
            .from('cakegenie_orders')
            .select(`
                *,
                cakegenie_order_items (
                    *
                )
            `)
            .eq('order_id', orderId)
            .single();

        if (orderDetailsError || !orderData) {
            console.error('Error fetching order details:', orderDetailsError);
            throw new Error('Failed to fetch order details for description');
        }

        // Construct Detailed Description
        let description = `Order #${orderData.order_number}`;
        if (orderData.cakegenie_order_items && orderData.cakegenie_order_items.length > 0) {
            orderData.cakegenie_order_items.forEach((item: any) => {
                description += ` | ${item.cake_size} ${item.cake_type}`;
            });
        }

        const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');

        const invoicePayload: Record<string, any> = {
            external_id: orderId,
            amount: amount,
            description: description.substring(0, 255),
            currency: 'PHP',
            customer: {
                given_names: customerName || 'Customer',
                email: customerEmail || 'customer@example.com'
            },
            success_redirect_url,
            failure_redirect_url
        };

        if (paymentTokenId) {
            invoicePayload.payment_method = {
                type: 'EWALLET',
                reusability: 'MULTIPLE_USE',
                ewallet: {
                    channel_properties: {
                        payment_token_id: paymentTokenId
                    }
                }
            };
        }

        console.log('Creating Invoice with payload:', JSON.stringify(invoicePayload, null, 2));

        const response = await fetch('https://api.xendit.co/v2/invoices', {
            method: 'POST',
            headers: {
                'Authorization': xenditAuthHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invoicePayload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Xendit API error (status ' + response.status + '):', errText);
            let errObj;
            try { errObj = JSON.parse(errText); } catch (_e) { errObj = { message: errText }; }
            throw new Error(`Xendit error (${response.status}): ${errObj.message || errText}`);
        }

        const invoice = await response.json();
        console.log('Invoice created:', JSON.stringify(invoice, null, 2));

        const { error: dbError } = await supabaseAdmin
            .from('xendit_payments')
            .insert({
                order_id: orderId,
                xendit_invoice_id: invoice.id,
                xendit_external_id: invoice.external_id,
                xendit_payment_request_id: invoice.id,
                status: invoice.status,
                amount: invoice.amount,
                payment_link_url: invoice.invoice_url,
                expiry_date: invoice.expiry_date
            });

        if (dbError) {
            console.error('Database error:', dbError);
            throw new Error('Failed to save payment record: ' + dbError.message);
        }

        return new Response(JSON.stringify({
            success: true,
            paymentUrl: invoice.invoice_url,
            paymentRequestId: invoice.id,
            invoiceId: invoice.id,
            expiresAt: invoice.expiry_date
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Error in create-xendit-payment:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
