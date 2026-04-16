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

        // Generate a unique code (retry on collision — extremely rare with 7-char suffix)
        let code = '';
        for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = generateCode();
            const { data: collision } = await serviceClient
                .from('discount_codes')
                .select('code')
                .eq('code', candidate)
                .maybeSingle();
            if (!collision) {
                code = candidate;
                break;
            }
        }

        if (!code) {
            return NextResponse.json(
                { success: false, error: 'Could not generate a unique code. Please try again.' },
                { status: 500 }
            );
        }

        // Insert into discount_codes tied to this specific user account
        const { error: discountInsertError } = await serviceClient
            .from('discount_codes')
            .insert({
                code,
                is_active: true,
                discount_percentage: 20,
                max_uses: 1,
                times_used: 0,
                free_delivery: false,
                one_per_user: true,
                new_users_only: false,
                user_id: userId,
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
