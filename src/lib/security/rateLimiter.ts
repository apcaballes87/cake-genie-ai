import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

interface RateLimitConfig {
    limit: number;
    window: string;
}

const LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    ai: { limit: 5, window: '60 s' },
    newsletter: { limit: 3, window: '60 s' },
    contact: { limit: 3, window: '60 s' },
    discount: { limit: 5, window: '60 s' },
};

const limiters: Record<string, Ratelimit> = {};

if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
        for (const [key, config] of Object.entries(LIMIT_CONFIGS)) {
            limiters[key] = new Ratelimit({
                redis: kv,
                limiter: Ratelimit.slidingWindow(config.limit, config.window as any),
                analytics: true,
                prefix: `ratelimit:genie:${key}`,
            });
        }
    } catch (err) {
        console.error('Failed to initialize Rate Limiters:', err);
    }
} else {
    if (process.env.NODE_ENV !== 'test') {
        console.warn('[RateLimiter] Vercel KV environment variables (KV_REST_API_URL / KV_REST_API_TOKEN) are missing. Rate limiting is disabled.');
    }
}

export async function checkRateLimit(
    type: 'ai' | 'newsletter' | 'contact' | 'discount',
    identifier: string
) {
    const limiter = limiters[type];
    if (!limiter) {
        return { success: true, remaining: 999, limit: 999, reset: Date.now() };
    }

    try {
        const result = await limiter.limit(identifier);
        return {
            success: result.success,
            remaining: result.remaining,
            limit: result.limit,
            reset: result.reset,
        };
    } catch (err) {
        console.error(`Rate limit check failed for ${type}, bypassing:`, err);
        return { success: true, remaining: 999, limit: 999, reset: Date.now() };
    }
}
