import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client — bypasses RLS so we can write to discount_codes
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        const { email, source = 'popup' } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return NextResponse.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
        }

        // Check if subscriber already exists and has a code
        const { data: existing } = await supabase
            .from('cakegenie_newsletter_subscribers')
            .select('discount_code')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existing?.discount_code) {
            // Returning subscriber — give them back their existing code
            return NextResponse.json({ success: true, code: existing.discount_code });
        }

        // Generate a unique code with collision retries. Insert directly and
        // catch unique-violation (23505) instead of select-then-insert, which
        // would race when two requests pick the same candidate concurrently.
        let code = '';
        for (let attempt = 0; attempt < 6; attempt++) {
            const candidate = generateCode();
            const { error: insertError } = await supabase
                .from('discount_codes')
                .insert({
                    code: candidate,
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

            if (insertError.code === '23505') {
                // Code collision — pick another candidate.
                continue;
            }

            console.error('[newsletter] Failed to insert discount code:', insertError);
            return NextResponse.json({ success: false, error: 'Failed to generate discount code.' }, { status: 500 });
        }

        if (!code) {
            return NextResponse.json({ success: false, error: 'Could not generate a unique code. Please try again.' }, { status: 500 });
        }

        // Upsert subscriber with the generated code
        const { error: subscriberError } = await supabase
            .from('cakegenie_newsletter_subscribers')
            .upsert(
                { email: normalizedEmail, source, discount_code: code, is_active: true },
                { onConflict: 'email' }
            );

        if (subscriberError) {
            console.error('[newsletter] Failed to upsert subscriber:', subscriberError);
            // Code is in discount_codes but subscriber wasn't saved — still return code so UX isn't broken
        }

        return NextResponse.json({ success: true, code });
    } catch (err) {
        console.error('[newsletter] Unexpected error:', err);
        return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
