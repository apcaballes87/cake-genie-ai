'use server';

import { createClient } from '@supabase/supabase-js';
import { AppError, type ErrorCode, wrapError } from '@/lib/errors';

// Use the service role key to bypass RLS for unique checking and inserting reliably
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

export type CreatorSubmission = {
    name: string;
    email: string;
    contact_number: string;
    address: string;

    tiktok_handle?: string;
    tiktok_followers?: number;

    instagram_handle?: string;
    instagram_followers?: number;

    facebook_handle?: string;
    facebook_followers?: number;

    promo_code: string;
    agreed_to_terms: boolean;
};

export async function submitCreatorApplication(data: CreatorSubmission) {
    try {
        // 1. Basic Validation
        if (!data.name || !data.email || !data.contact_number || !data.address) {
            throw new AppError('Please fill in all required personal details.', 'VALIDATION_ERROR');
        }

        if (!data.agreed_to_terms) {
            throw new AppError('You must agree to the terms to proceed.', 'VALIDATION_ERROR');
        }

        // 2. Validate at least one social handle
        const hasSocialHandle = !!(data.tiktok_handle || data.instagram_handle || data.facebook_handle);
        if (!hasSocialHandle) {
            throw new AppError('Please provide at least one social media handle.', 'VALIDATION_ERROR');
        }

        // 3. Clean up the promo code
        // Remove spaces and special characters, make it uppercase for consistency
        const cleanPromoCode = data.promo_code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        if (!cleanPromoCode) {
             throw new AppError('Invalid promo code selected.', 'VALIDATION_ERROR');
        }

        // 4. Check for promo code uniqueness
        const { data: existing, error: checkError } = await supabase
            .from('creators')
            .select('id')
            .ilike('promo_code', cleanPromoCode)
            .single();

        if (existing) {
            throw new AppError('This promo code is already taken. Please select a different one or append numbers to it.', 'CONFLICT');
        }

        // Ignore single row not found error (which is what we want)
        if (checkError && checkError.code !== 'PGRST116') {
             console.error('Error checking promo code:', JSON.stringify(checkError, Object.getOwnPropertyNames(checkError), 2));
             throw new AppError('Failed to verify promo code availability.', 'DATABASE_ERROR');
        }

        // 5. Insert into Database
        const { error: insertError } = await supabase
            .from('creators')
            .insert({
                ...data,
                promo_code: cleanPromoCode
            });

        if (insertError) {
             console.error('Error inserting creator:', JSON.stringify(insertError, Object.getOwnPropertyNames(insertError), 2));
             // Handle unique constraint violation specifically just in case of race condition
             if (insertError.code === '23505' && insertError.message.includes('promo_code')) {
                 throw new AppError('This promo code is already taken. Please select a different one.', 'CONFLICT');
             }
             throw new AppError('Failed to submit application. Please try again later.', 'DATABASE_ERROR');
        }

        return { success: true };
    } catch (error) { throw wrapError(error, 'Failed to submit application', 'DATABASE_ERROR'); }
}
