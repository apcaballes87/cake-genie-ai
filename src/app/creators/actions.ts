'use server';

import { createClient } from '@supabase/supabase-js';
import { AppError, isAppError } from '@/lib/errors';
import { normalizeCreatorPromoCode } from './promoCode';

const RESERVED_CODES = new Set([
    'ABOUT', 'ACCOUNT', 'ADMIN', 'API', 'AUTH', 'BLOG', 'CART', 'COLLECTIONS',
    'COMPARE', 'CONTACT', 'CUSTOMIZING', 'FAQ', 'LOGIN', 'PAYMENT', 'PRIVACY',
    'REVIEWS', 'SEARCH', 'SHOP', 'SIGNUP', 'TERMS',
]);

export type CreatorSubmission = {
    name: string;
    email: string;
    contact_number: string;
    address: string;
    content_niche: string;
    tiktok_handle?: string;
    tiktok_followers?: number;
    instagram_handle?: string;
    instagram_followers?: number;
    facebook_handle?: string;
    facebook_followers?: number;
    promo_code: string;
    agreed_to_terms: boolean;
};

export type CreatorApplicationResult = {
    success: true;
    creatorId: string;
    referralCode: string;
    bentoCode: string;
    voucherCode: string;
};

export type CreatorSubmissionFailure = {
    success: false;
    error: string;
    code?: string;
};

export type CreatorSubmissionResult = CreatorApplicationResult | CreatorSubmissionFailure;

export type PromoCodeAvailability = {
    available: boolean;
    code: string;
    message?: string;
};

function requireServiceClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new AppError('Creator applications are temporarily unavailable.', 'DATABASE_ERROR');
    }

    try {
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });
    } catch (error) {
        throw new AppError('Creator applications are temporarily unavailable.', 'DATABASE_ERROR', 500, error);
    }
}

function validateCreatorSubmission(data: CreatorSubmission) {
    if (!data.name?.trim() || !data.email?.trim() || !data.contact_number?.trim() || !data.address?.trim() || !data.content_niche?.trim()) {
        throw new AppError('Please fill in all required application details.', 'VALIDATION_ERROR');
    }

    if (!/^\S+@\S+\.\S+$/.test(data.email.trim())) {
        throw new AppError('Please provide a valid email address.', 'VALIDATION_ERROR');
    }

    if (!data.agreed_to_terms) {
        throw new AppError('You must agree to the creator collaboration terms.', 'VALIDATION_ERROR');
    }

    if (!data.tiktok_handle?.trim() && !data.instagram_handle?.trim() && !data.facebook_handle?.trim()) {
        throw new AppError('Please provide at least one social media handle.', 'VALIDATION_ERROR');
    }

    for (const followers of [data.tiktok_followers, data.instagram_followers, data.facebook_followers]) {
        if (followers !== undefined && (!Number.isInteger(followers) || followers < 0)) {
            throw new AppError('Follower counts must be zero or greater.', 'VALIDATION_ERROR');
        }
    }

    const promoCode = normalizeCreatorPromoCode(data.promo_code || '');
    if (promoCode.length < 4 || promoCode.length > 24) {
        throw new AppError('Your custom promo code must be 4 to 24 letters or numbers.', 'VALIDATION_ERROR');
    }

    if (RESERVED_CODES.has(promoCode)) {
        throw new AppError('That promo code is reserved. Please choose another code.', 'CONFLICT');
    }

    return promoCode;
}

export async function checkCreatorPromoCode(code: string): Promise<PromoCodeAvailability> {
    const normalizedCode = normalizeCreatorPromoCode(code || '');

    if (normalizedCode.length < 4 || normalizedCode.length > 24) {
        return {
            available: false,
            code: normalizedCode,
            message: 'Use 4 to 24 letters or numbers.',
        };
    }

    if (RESERVED_CODES.has(normalizedCode)) {
        return {
            available: false,
            code: normalizedCode,
            message: 'That code is reserved.',
        };
    }

    try {
        const client = requireServiceClient();
        const [{ data: creatorMatches, error: creatorError }, { data: discountMatches, error: discountError }] = await Promise.all([
            client.from('creators').select('id').ilike('promo_code', normalizedCode).limit(1),
            client.from('discount_codes').select('code_id').ilike('code', normalizedCode).limit(1),
        ]);

        if (creatorError || discountError) {
            throw creatorError || discountError;
        }

        const available = creatorMatches.length === 0 && discountMatches.length === 0;
        return {
            available,
            code: normalizedCode,
            message: available ? 'Promo code is available.' : 'That promo code is already taken.',
        };
    } catch (error) {
        console.error('Error checking creator promo code:', error);
        return {
            available: false,
            code: normalizedCode,
            message: 'Could not verify this code right now.',
        };
    }
}

export async function submitCreatorApplication(data: CreatorSubmission): Promise<CreatorSubmissionResult> {
    try {
        const client = requireServiceClient();
        const promoCode = validateCreatorSubmission(data);

        const { data: result, error } = await client.rpc('submit_creator_application', {
            p_name: data.name.trim(),
            p_email: data.email.trim().toLowerCase(),
            p_contact_number: data.contact_number.trim(),
            p_address: data.address.trim(),
            p_content_niche: data.content_niche.trim(),
            p_tiktok_handle: data.tiktok_handle?.trim() || null,
            p_tiktok_followers: data.tiktok_followers ?? null,
            p_instagram_handle: data.instagram_handle?.trim() || null,
            p_instagram_followers: data.instagram_followers ?? null,
            p_facebook_handle: data.facebook_handle?.trim() || null,
            p_facebook_followers: data.facebook_followers ?? null,
            p_promo_code: promoCode,
            p_agreed_to_terms: true,
        });

        if (error) {
            if (error.code === '23505' || error.message.includes('CREATOR_PROMO_CODE_TAKEN')) {
                return { success: false, error: 'That promo code is already taken. Please choose another one.', code: 'CONFLICT' };
            }

            if (error.code === '22023') {
                return { success: false, error: error.message, code: 'VALIDATION_ERROR' };
            }

            return { success: false, error: 'We could not process your application right now. Please try again later.' };
        }

        const application = Array.isArray(result) ? result[0] : result;
        if (!application?.creator_id || !application.referral_code || !application.bento_code || !application.voucher_code) {
            return { success: false, error: 'The application was not completed. Please try again.', code: 'DATABASE_ERROR' };
        }

        return {
            success: true,
            creatorId: application.creator_id,
            referralCode: application.referral_code,
            bentoCode: application.bento_code,
            voucherCode: application.voucher_code,
        };
    } catch (error) {
        if (isAppError(error)) {
            console.error('Error submitting creator application:', error.message);
            return { success: false, error: error.message, code: error.code };
        }

        console.error('Error submitting creator application:', error);
        return {
            success: false,
            error: 'We could not process your application right now. Please try again later.',
            code: 'DATABASE_ERROR',
        };
    }
}
