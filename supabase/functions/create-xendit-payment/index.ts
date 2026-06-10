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

        const requestBody = await req.json();
        console.log('Received request body:', JSON.stringify(requestBody, null, 2));

        const {
            orderId,
            success_redirect_url,
            failure_redirect_url,
            payment_mode,
            customerEmail,
            customerName,
            paymentTokenId
        } = requestBody;

        console.log('Processing payment for Order ID:', orderId);

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

        const amount = order.total_amount;
        console.log(`Order ${order.order_number} Total Amount: ${amount}`);

        // 2. Handle Free Orders (100% Discount)
        if (amount <= 0) {
            console.log('Order amount is 0 or negative. Marking as PAID immediately.');

            // Mark as paid directly
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

        // 3. Proceed with Xendit Payment Request API v3 for non-zero amounts
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
        let description = `Order #${orderData.order_number}\n\n`;
        const baseUrl = success_redirect_url ? success_redirect_url.split('/order-confirmation')[0] : 'https://cakegenie.ph';
        description += `View Customization Details: ${baseUrl}/account/orders\n\n`;

        if (orderData.cakegenie_order_items && orderData.cakegenie_order_items.length > 0) {
            orderData.cakegenie_order_items.forEach((item: any, index: number) => {
                const details = item.customization_details;
                if (index > 0) description += '\n-------------------\n\n';

                description += `Type:\n${item.cake_size} ${item.cake_type}\n`;

                if (details.flavors && details.flavors.length > 0) {
                    description += `Flavor:\n${details.flavors.join(', ')}\n`;
                }

                if (details.mainToppers && details.mainToppers.length > 0) {
                    const toppers = details.mainToppers.map((t: any) => `${t.description} (${t.size || 'medium'})`).join(', ');
                    description += `Main Toppers:\n${toppers}\n`;
                }
            });
        }

        // Create Payment Request via Xendit Payment Request API v3
        const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');

        // Build payment request body
        const paymentRequestPayload: Record<string, any> = {
            external_id: orderId,
            amount: amount,
            description: description.substring(0, 500), // V3 has 500 char limit
            type: 'PAY', // One-time payment, shows available methods
            currency: 'PHP',
            customer: {
                given_names: customerName || 'Customer',
                email: customerEmail || 'customer@example.com'
            },
            success_redirect_url,
            failure_redirect_url
        };

        // If paymentTokenId is provided (PAY_AND_SAVE for returning users with Maya)
        if (paymentTokenId) {
            paymentRequestPayload.type = 'PAY_AND_SAVE';
            paymentRequestPayload.payment_method = {
                type: 'EWALLET',
                reusability: 'MULTIPLE_USE'
            };
        }

        console.log('Creating Payment Request with payload:', JSON.stringify(paymentRequestPayload, null, 2));

        const response = await fetch('https://api.xendit.co/v2/payment_requests', {
            method: 'POST',
            headers: {
                'Authorization': xenditAuthHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentRequestPayload)
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Xendit API error:', err);
            throw new Error(err.message || 'Failed to create Xendit payment request');
        }

        const paymentRequest = await response.json();
        console.log('Payment Request created:', JSON.stringify(paymentRequest, null, 2));

        // Extract payment URL from actions array (REDIRECT_CUSTOMER type)
        let paymentUrl = null;
        if (paymentRequest.actions && Array.isArray(paymentRequest.actions)) {
            const redirectAction = paymentRequest.actions.find(
                (action: any) => action.type === 'REDIRECT_CUSTOMER'
            );
            if (redirectAction) {
                paymentUrl = redirectAction.value;
            }
        }

        // Also extract token_id for future PAY_AND_SAVE usage
        const tokenId = paymentRequest.payment_method?.token_id || null;

        // Save to database
        const { error: dbError } = await supabaseAdmin
            .from('xendit_payments')
            .insert({
                order_id: orderId,
                xendit_payment_request_id: paymentRequest.id,
                xendit_external_id: paymentRequest.external_id,
                xendit_invoice_id: paymentRequest.id, // Keep for backward compat
                status: paymentRequest.status,
                amount: paymentRequest.amount,
                payment_link_url: paymentUrl,
                payment_token_id: tokenId,
                expiry_date: paymentRequest.expires_at
            });

        if (dbError) {
            console.error('Database error:', dbError);
            throw new Error('Failed to save payment record: ' + dbError.message);
        }

        return new Response(JSON.stringify({
            success: true,
            paymentUrl: paymentUrl,
            paymentRequestId: paymentRequest.id,
            tokenId: tokenId,
            expiresAt: paymentRequest.expires_at
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
