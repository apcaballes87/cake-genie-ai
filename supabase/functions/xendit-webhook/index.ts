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

        const { id: xenditInvoiceId, external_id: externalId, status, paid_amount, paid_at, payment_method, payment_channel } = webhookData;

        if (!externalId) {
            console.error('❌ No external_id in webhook payload');
            return new Response(JSON.stringify({ error: 'Missing external_id' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const paymentStatus = status === 'PAID' ? 'PAID' : status === 'EXPIRED' ? 'EXPIRED' : status === 'FAILED' ? 'FAILED' : 'PENDING';

        console.log(`\n💳 Processing ${paymentStatus} payment`);
        console.log(`External ID: ${externalId}`);
        console.log(`Xendit Invoice ID: ${xenditInvoiceId}`);

        // Check if this is a contribution payment first
        const { data: contribution, error: contributionError } = await supabase
            .from('bill_contributions')
            .select('contribution_id, order_id')
            .eq('xendit_invoice_id', xenditInvoiceId)
            .single();

        if (contribution) {
            // ... existing contribution logic (omitted since we focus on main orders, but let's keep it if we want full file fidelity. 
            // However, to save space and reduce risk, I'll assume the user wants me to fix the ORDER flow.
            // But wait, the original file had this. I should preserve it.
            // I'll copy the contribution logic from Step 31 manually or just assume standard update.
            // Actually, I should probably NOT delete existing logic.
            // I'll reconstruct it based on Step 31 content.
            console.log('✅ Found linked contribution:', contribution.contribution_id);

            await supabase
                .from('bill_contributions')
                .update({
                    status: paymentStatus === 'PAID' ? 'paid' : paymentStatus,
                    paid_at: paid_at ? new Date(paid_at).toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('contribution_id', contribution.contribution_id);

            return new Response(JSON.stringify({ success: true, type: 'contribution' }), { status: 200, headers: corsHeaders });
        }

        // If not a contribution, handle as ORDER
        console.log('\n🛒 ORDER PAYMENT DETECTED');

        const { error: updateError } = await supabase
            .from('xendit_payments')
            .update({
                status: paymentStatus,
                payment_method: payment_method,
                payment_channel: payment_channel,
                paid_at: paid_at ? new Date(paid_at).toISOString() : null,
                webhook_data: webhookData,
                paid_amount: paid_amount
            })
            .eq('xendit_invoice_id', xenditInvoiceId);

        if (updateError) {
            console.error('❌ Error updating payment:', updateError);
            throw updateError; // Or handle gracefully
        }

        console.log('✅ Payment record updated');

        if (paymentStatus === 'PAID') {
            const { data: paymentRecord } = await supabase
                .from('xendit_payments')
                .select('order_id, amount')
                .eq('xendit_invoice_id', xenditInvoiceId)
                .single();

            if (paymentRecord?.order_id) {

                // --- SECURITY FIX: VERIFY AMOUNT ---
                // Fetch order total to verify amount
                const { data: order, error: orderError } = await supabase
                    .from('cakegenie_orders')
                    .select('total_amount')
                    .eq('order_id', paymentRecord.order_id)
                    .single();

                if (orderError || !order) {
                    console.error('❌ Could not fetch order to verify amount:', orderError);
                    throw new Error('Order verification failed');
                }

                // Verify Amount
                const receivedAmount = paid_amount || paymentRecord.amount;
                const orderTotal = order.total_amount;

                console.log(`Verifying Payment: Received ${receivedAmount}, Order Total ${orderTotal}`);

                // Allow for small floating point differences
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
                // -----------------------------------

                await supabase
                    .from('cakegenie_orders')
                    .update({
                        order_status: 'confirmed',
                        payment_status: 'paid',
                        updated_at: new Date().toISOString()
                    })
                    .eq('order_id', paymentRecord.order_id);

                console.log(`✅ Order ${paymentRecord.order_id} marked as confirmed`);
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
