import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            orderId,
            amount,
            customerEmail,
            customerName,
            items,
            success_redirect_url,
            failure_redirect_url,
            payment_mode
        } = await req.json();

        const mode = payment_mode || 'test';
        // Check for mode-specific key first, then fall back to XENDIT_SECRET_KEY for backward compatibility
        const XENDIT_SECRET_KEY = mode === 'live'
            ? (Deno.env.get('XENDIT_LIVE_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'))
            : (Deno.env.get('XENDIT_TEST_API_KEY') || Deno.env.get('XENDIT_SECRET_KEY'));

        if (!XENDIT_SECRET_KEY) {
            throw new Error(`Xendit API Key for ${mode} mode is not set.`);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase environment variables are not set.');
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
                description: `Order #${orderId}`,
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
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
