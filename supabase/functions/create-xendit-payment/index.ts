import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const requestBody = await req.json();
        console.log('Received request body:', JSON.stringify(requestBody, null, 2));

        const {
            orderId,
            amount,
            customerEmail,
            customerName,
            items,
            success_redirect_url,
            failure_redirect_url,
            payment_mode
        } = requestBody;

        console.log('Extracted values:', {
            orderId,
            amount,
            customerEmail,
            customerName,
            itemsCount: items?.length,
            payment_mode
        });

        const mode = payment_mode || 'test';
        // Check for mode-specific key first, then fall back to XENDIT_SECRET_KEY for backward compatibility
        const XENDIT_SECRET_KEY = mode === 'live'
            ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
            : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));

        console.log('Using API key for mode:', mode, 'Key exists:', !!XENDIT_SECRET_KEY);

        if (!XENDIT_SECRET_KEY) {
            throw new Error(`Xendit API Key for ${mode} mode is not set.`);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase environment variables are not set.');
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // Fetch Order Details for Description
        const { data: orderData, error: orderError } = await supabaseAdmin
            .from('cakegenie_orders')
            .select(`
                *,
                cakegenie_order_items (
                    *
                )
            `)
            .eq('order_id', orderId)
            .single();

        if (orderError || !orderData) {
            console.error('Error fetching order details:', orderError);
            throw new Error('Failed to fetch order details for description');
        }

        // Construct Detailed Description
        let description = `Order #${orderData.order_number}\n\n`;
        description += `View Customization Details: ${requestBody.success_redirect_url.split('#')[0]}#/account/orders\n\n`;

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

                if (details.supportElements && details.supportElements.length > 0) {
                    const support = details.supportElements.map((s: any) => `${s.description} (${s.coverage || 'medium'})`).join(', ');
                    description += `Support:\n${support}\n`;
                }

                if (details.cakeMessages && details.cakeMessages.length > 0) {
                    details.cakeMessages.forEach((msg: any, i: number) => {
                        description += `Message #${i + 1}:\n'${msg.text}' (${msg.color})\n`;
                    });
                }

                if (details.icingDesign && details.icingDesign.colors) {
                    const colors = details.icingDesign.colors;
                    if (colors.top) description += `Top Color:\n${colors.top}\n`;
                    if (colors.side) description += `Side Color:\n${colors.side}\n`;
                    if (colors.topBorder) description += `Top Border Color:\n${colors.topBorder}\n`;
                    if (colors.baseBorder) description += `Base Border Color:\n${colors.baseBorder}\n`;
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
                amount: amount,
                payer_email: customerEmail,
                description: description, // Use the detailed description
                invoice_duration: 86400, // 24 hours
                success_redirect_url,
                failure_redirect_url,
                items: items,
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
        // Note: We are not storing payment_mode in DB yet as schema might not have it.
        // If we want to store it, we need to add the column.
        // For now, we'll rely on client passing it for verification or just trying both keys if needed (but client passing is better).
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
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
