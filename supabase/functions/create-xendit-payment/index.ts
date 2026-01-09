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
            items,
            customerEmail,
            customerName
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
                    order_status: 'confirmed', // or 'pending_fulfillment' depending on workflow
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', orderId);

            if (updateError) {
                console.error('Failed to update free order status:', updateError);
                throw new Error('Failed to process free order');
            }

            return new Response(JSON.stringify({
                success: true,
                paymentUrl: success_redirect_url, // Redirect directly to success
                invoiceId: 'FREE-' + orderId,
                isFree: true
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 3. Proceed with Xendit Payment for non-zero amounts
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
        // Use client-provided success_redirect_url base or fallback
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

        // Create Invoice
        const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');
        const response = await fetch('https://api.xendit.co/v2/invoices', {
            method: 'POST',
            headers: {
                'Authorization': xenditAuthHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                external_id: orderId,
                amount: amount, // TRUSTED AMOUNT FROM DB
                payer_email: customerEmail,
                description: description,
                invoice_duration: 86400,
                success_redirect_url,
                failure_redirect_url,
                items: items, // Using items for display, but amount is overridden
                customer: {
                    given_names: customerName,
                    email: customerEmail
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to create Xendit invoice');
        }

        const invoice = await response.json();

        // Save to database
        const { error: dbError } = await supabaseAdmin
            .from('xendit_payments')
            .insert({
                order_id: orderId,
                xendit_invoice_id: invoice.id,
                xendit_external_id: invoice.external_id,
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
