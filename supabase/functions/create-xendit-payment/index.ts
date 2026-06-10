import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

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
            payment_mode,
            customerEmail,
            customerName,
            paymentTokenId
        } = requestBody || {};

        console.log('Processing payment for Order ID:', orderId, 'payment_mode:', payment_mode);

        // 1. Fetch Order from Database to get Trusted Amount
        const { data: order, error: orderError } = await supabaseAdmin
            .from('cakegenie_orders')
            .select('total_amount, order_number, user_id, order_status, payment_status')
            .eq('order_id', orderId)
            .single();

        if (orderError || !order) {
            console.error('Order not found or access denied:', orderError);
            throw new Error('Order not found');
        }

        const amount = Number(order.total_amount);
        console.log(`Order ${order.order_number} Total Amount: ${amount} (type: ${typeof amount})`);

        // 2. Handle Free Orders (100% Discount)
        if (amount <= 0) {
            console.log('Order amount is 0 or negative. Marking as PAID immediately.');

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
        const mode = payment_mode || 'test';
        const XENDIT_SECRET_KEY = mode === 'live'
            ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
            : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));

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
