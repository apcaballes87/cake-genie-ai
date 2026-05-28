import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client — bypasses RLS so we can write to discount_codes
const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

/**
 * Generates a unique, human-readable discount code.
 * Uses a character set that avoids visual ambiguity (no 0/O/1/I).
 * Example: GENIE-K7MN3Q
 */
function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 7; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `GENIE${suffix}`;
}

export async function POST(request: NextRequest) {
    try {
        // Verify caller is an authenticated, non-anonymous user via their session cookie
        const serverSupabase = await createServerClient();
        const { data: { user } } = await serverSupabase.auth.getUser();

        if (!user || user.is_anonymous) {
            return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
        }

        const { source = 'popup' } = await request.json().catch(() => ({}));
        const userId = user.id;
        const email = user.email;

        // Check if this user already has a discount code tied to their account
        const { data: existingUserCode } = await serviceClient
            .from('discount_codes')
            .select('code')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();

        if (existingUserCode?.code) {
            return NextResponse.json({ success: true, code: existingUserCode.code });
        }

        // Also check the newsletter subscribers table for a legacy code linked to this email
        if (email) {
            const { data: existingSubscriber } = await serviceClient
                .from('cakegenie_newsletter_subscribers')
                .select('discount_code')
                .eq('email', email.trim().toLowerCase())
                .maybeSingle();

            if (existingSubscriber?.discount_code) {
                return NextResponse.json({ success: true, code: existingSubscriber.discount_code });
            }
        }

        // Generate a unique code with collision retries. We rely on the unique
        // index on discount_codes.code to detect collisions atomically — a
        // select-then-insert race otherwise lets two concurrent requests both
        // believe a candidate is free. Postgres unique-violation is SQLSTATE 23505.
        let code = '';
        for (let attempt = 0; attempt < 6; attempt++) {
            const candidate = generateCode();
            const { error: insertError } = await serviceClient
                .from('discount_codes')
                .insert({
                    code: candidate,
                    user_id: userId,
                    // Kept public_code: true so the client-side anon revalidation
                    // (CartClient + DiscountOfferBubble) can still read the row via
                    // the discount_select_public RLS policy. The server RPC in
                    // create_order_from_cart enforces user_id != p_user_id at order
                    // creation, so this is not a real authorization gap.
                    public_code: true,
                    is_active: true,
                    discount_percentage: 20,
                    max_uses: 1,
                    times_used: 0,
                    free_delivery: false,
                    one_per_user: false,
                    new_users_only: false,
                    max_discount_amount: 2000,
                });

            if (!insertError) {
                code = candidate;
                break;
            }

            // 23505 = unique_violation — try another candidate.
            if (insertError.code === '23505') {
                continue;
            }

            console.error('[signup-discount] Failed to insert discount code:', insertError);
            return NextResponse.json(
                { success: false, error: 'Failed to generate discount code.' },
                { status: 500 }
            );
        }

        if (!code) {
            return NextResponse.json(
                { success: false, error: 'Could not generate a unique code. Please try again.' },
                { status: 500 }
            );
        }

        // Side effect: subscribe their email to the newsletter
        if (email) {
            const normalizedEmail = email.trim().toLowerCase();
            const { error: subscriberError } = await serviceClient
                .from('cakegenie_newsletter_subscribers')
                .upsert(
                    { email: normalizedEmail, source, discount_code: code, is_active: true },
                    { onConflict: 'email' }
                );

            if (subscriberError) {
                // Non-fatal — code was created; don't fail the whole request
                console.error('[signup-discount] Failed to upsert subscriber:', subscriberError);
            }
        }

        return NextResponse.json({ success: true, code });
    } catch (err) {
        console.error('[signup-discount] Unexpected error:', err);
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred.' },
            { status: 500 }
        );
    }
}
