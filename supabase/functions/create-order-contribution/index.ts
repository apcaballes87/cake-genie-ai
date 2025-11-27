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
        const {
            orderId,
            contributorName,
            contributorEmail,
            amount,
            userId,
            success_redirect_url,
            failure_redirect_url,
            payment_mode
        } = requestBody;

        if (!orderId || !amount || !contributorEmail) {
            throw new Error('Missing required fields: orderId, amount, contributorEmail');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase environment variables are not set.');
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // 1. Validate Order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('cakegenie_orders')
            .select('total_amount, amount_collected, is_split_order, order_status, order_number')
            .eq('order_id', orderId)
            .single();

        if (orderError || !order) {
            throw new Error('Order not found');
        }

        if (!order.is_split_order) {
            throw new Error('This is not a split order');
        }

        // Allow contributions if pending or partially paid (logic might vary, but usually pending)
        // The trigger updates to 'confirmed'/'paid' when fully funded.
        // If it's already confirmed, maybe we shouldn't allow more?
        if (order.order_status === 'confirmed' || order.order_status === 'cancelled') {
            throw new Error(`Order is already ${order.order_status}`);
        }

        const currentCollected = order.amount_collected || 0;
        const remaining = order.total_amount - currentCollected;

        // Allow a small buffer for float comparison if needed, but usually strict
        if (amount > remaining) {
            throw new Error(`Contribution amount (${amount}) exceeds remaining balance (${remaining})`);
        }

        // 2. Create Contribution Record
        const { data: contribution, error: contribError } = await supabaseAdmin
            .from('order_contributions')
            .insert({
                order_id: orderId,
                user_id: userId || null,
                contributor_name: contributorName,
                contributor_email: contributorEmail,
                amount: amount,
                status: 'pending'
            })
            .select()
            .single();

        if (contribError) {
            throw new Error('Failed to create contribution record: ' + contribError.message);
        }

        // 3. Create Xendit Invoice
        const mode = payment_mode || 'test';
        const XENDIT_SECRET_KEY = mode === 'live'
            ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
            : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));

        if (!XENDIT_SECRET_KEY) {
            throw new Error(`Xendit API Key for ${mode} mode is not set.`);
        }

        const xenditAuthHeader = 'Basic ' + btoa(XENDIT_SECRET_KEY + ':');
        const externalId = contribution.contribution_id; // Use contribution ID as external ID

        const xenditResponse = await fetch('https://api.xendit.co/v2/invoices', {
            method: 'POST',
            headers: {
                'Authorization': xenditAuthHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                external_id: externalId,
                amount: amount,
                payer_email: contributorEmail,
                description: `Contribution for Order ${order.order_number}`,
                invoice_duration: 86400, // 24 hours
                success_redirect_url: `${success_redirect_url}&contribution_id=${externalId}`,
                failure_redirect_url: `${failure_redirect_url}&contribution_id=${externalId}`,
                customer: {
                    given_names: contributorName,
                    email: contributorEmail
                }
            })
        });

        if (!xenditResponse.ok) {
            const err = await xenditResponse.json();
            throw new Error(err.message || 'Failed to create Xendit invoice');
        }

        const invoice = await xenditResponse.json();

        // 4. Update Contribution with Invoice Details
        const { error: updateError } = await supabaseAdmin
            .from('order_contributions')
            .update({
                xendit_invoice_id: invoice.id,
                payment_url: invoice.invoice_url,
                updated_at: new Date().toISOString()
            })
            .eq('contribution_id', contribution.contribution_id);

        if (updateError) {
            console.error('Failed to update contribution with invoice:', updateError);
            // We might want to void the invoice if we can't save it, but for now just throw
            throw new Error('Failed to update contribution record');
        }

        return new Response(JSON.stringify({
            success: true,
            paymentUrl: invoice.invoice_url,
            contributionId: contribution.contribution_id,
            invoiceId: invoice.id
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Error in create-order-contribution:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
