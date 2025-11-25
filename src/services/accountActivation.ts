import { getSupabaseClient } from '../lib/supabase/client';

/**
 * Upgrades an anonymous Supabase account to an email-based account
 * and sends a password setup email
 * 
 * This is called after a guest completes their order to convert their
 * anonymous session into a full account they can access later.
 */
export async function upgradeAnonymousToEmailAccount(params: {
    email: string;
    firstName?: string;
    lastName?: string;
}): Promise<{ success: boolean; error?: Error }> {
    try {
        const supabase = getSupabaseClient();
        const { email, firstName, lastName } = params;

        // Get current user (should be anonymous)
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: new Error('No authenticated user found') };
        }

        if (!user.is_anonymous) {
            // Already a full account, no need to upgrade
            return { success: true };
        }

        // Link email to anonymous account
        // Set shouldCreateUser to false since we're linking to existing anonymous user
        const { error: updateError } = await supabase.auth.updateUser({
            email: email,
            data: {
                first_name: firstName,
                last_name: lastName,
            }
        }, {
            emailRedirectTo: `${window.location.origin}/#/auth/set-password`
        });

        if (updateError) throw updateError;

        console.log('Successfully linked email to anonymous account:', email);
        console.log('User will receive email confirmation. After confirming, they can set a password via "Forgot Password" flow.');

        return { success: true };

    } catch (error: any) {
        console.error('Error upgrading anonymous account:', error);
        return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Checks the status of an email account
 * Useful for detecting if a user has an account but hasn't set a password yet
 */
export async function checkAccountStatus(email: string): Promise<{
    exists: boolean;
    hasPassword: boolean;
    isAnonymous: boolean;
}> {
    try {
        const supabase = getSupabaseClient();

        // Try to get user info by email (admin function, may not work in all contexts)
        // For now, we'll check if they can sign in
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: '__test_password_that_should_fail__', // Invalid password
        });

        // If error is "Invalid login credentials", account exists but password is wrong
        if (error?.message?.includes('Invalid login credentials')) {
            return {
                exists: true,
                hasPassword: true,
                isAnonymous: false,
            };
        }

        // If error is "Email not confirmed", account exists
        if (error?.message?.includes('Email not confirmed')) {
            return {
                exists: true,
                hasPassword: false, // Probably hasn't set password yet
                isAnonymous: false,
            };
        }

        // For safety, assume account doesn't exist
        return {
            exists: false,
            hasPassword: false,
            isAnonymous: false,
        };

    } catch (error) {
        console.error('Error checking account status:', error);
        return {
            exists: false,
            hasPassword: false,
            isAnonymous: false,
        };
    }
}
