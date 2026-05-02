import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
    inspectExistingSignupDiscount,
    generateUniqueSignupDiscountCode,
} from '@/lib/server/signupDiscount';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client — bypasses RLS so we can write to discount_codes
const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

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

        const existingCode = await inspectExistingSignupDiscount(serviceClient, { userId, email });
        if (existingCode.status === 'reusable') {
            return NextResponse.json({ success: true, code: existingCode.code });
        }

        if (existingCode.status === 'blocked') {
            return NextResponse.json({ success: false, error: existingCode.message }, { status: 409 });
        }

        const code = await generateUniqueSignupDiscountCode(serviceClient);
        if (!code) {
            return NextResponse.json(
                { success: false, error: 'Could not generate a unique code. Please try again.' },
                { status: 500 }
            );
        }

        // Insert into discount_codes. We intentionally do NOT set user_id or
        // one_per_user — both fields require an active auth session to validate,
        // and CartClient re-validates before auth hydrates, causing a false
        // "must be logged in" rejection. max_uses: 1 is the sole reuse guard;
        // the code is already unique and tracked per-email via newsletter_subscribers.
        const { error: discountInsertError } = await serviceClient
            .from('discount_codes')
            .insert({
                code,
                is_active: true,
                discount_percentage: 20,
                max_uses: 1,
                times_used: 0,
                free_delivery: false,
                one_per_user: false,
                new_users_only: false,
            });

        if (discountInsertError) {
            console.error('[signup-discount] Failed to insert discount code:', discountInsertError);
            return NextResponse.json(
                { success: false, error: 'Failed to generate discount code.' },
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
