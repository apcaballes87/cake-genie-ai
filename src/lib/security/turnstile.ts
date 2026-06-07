/**
 * Verifies a Cloudflare Turnstile token.
 * Returns { success: true } if validation passes or if Turnstile secret key is not configured.
 */
export async function verifyTurnstileToken(
    token: string | undefined,
    ip?: string
): Promise<{ success: boolean; error?: string }> {
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

    // Developer bypass: if the secret key is not configured, warn and allow the request.
    if (!secretKey) {
        if (process.env.NODE_ENV !== 'test') {
            console.warn('[Turnstile] CLOUDFLARE_TURNSTILE_SECRET_KEY is not defined. Bypassing Turnstile validation.');
        }
        return { success: true };
    }

    if (!token) {
        return { success: false, error: 'Verification token is missing. Please complete the security check.' };
    }

    try {
        const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        
        // Build URL encoded parameters as required by Cloudflare
        const bodyParams = new URLSearchParams();
        bodyParams.append('secret', secretKey);
        bodyParams.append('response', token);
        if (ip) {
            bodyParams.append('remoteip', ip);
        }

        const res = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyParams.toString(),
        });

        if (!res.ok) {
            return { success: false, error: `Cloudflare Turnstile service returned status ${res.status}` };
        }

        const data = await res.json();
        if (data.success) {
            return { success: true };
        }

        console.error('[Turnstile] Cloudflare verification failed:', data['error-codes']);
        return { success: false, error: 'Security verification failed. Please try again.' };
    } catch (err) {
        console.error('[Turnstile] Request error:', err);
        return { success: false, error: 'Security verification service is temporarily unavailable.' };
    }
}
