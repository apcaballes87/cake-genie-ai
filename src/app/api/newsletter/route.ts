import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    inspectExistingSignupDiscount,
    generateUniqueSignupDiscountCode,
} from '@/lib/server/signupDiscount';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client — bypasses RLS so we can write to discount_codes
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

        const existingCode = await inspectExistingSignupDiscount(supabase, { email: normalizedEmail });
        if (existingCode.status === 'reusable') {
            // Returning subscriber — give them back their existing still-usable code.
            return NextResponse.json({ success: true, code: existingCode.code });
        }

        if (existingCode.status === 'blocked') {
            return NextResponse.json({ success: false, error: existingCode.message }, { status: 409 });
        }

        const code = await generateUniqueSignupDiscountCode(supabase);
        if (!code) {
            return NextResponse.json({ success: false, error: 'Could not generate a unique code. Please try again.' }, { status: 500 });
        }

        // Insert into discount_codes so validateDiscountCode() in discountService.ts works as-is
        const { error: discountInsertError } = await supabase
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
            console.error('[newsletter] Failed to insert discount code:', discountInsertError);
            return NextResponse.json({ success: false, error: 'Failed to generate discount code.' }, { status: 500 });
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
