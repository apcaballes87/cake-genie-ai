import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

interface RateLimitConfig {
    limit: number;
    window: `${number} ${'s' | 'm' | 'h' | 'd'}`;
}

const LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    ai: { limit: 5, window: '60 s' },
    newsletter: { limit: 3, window: '60 s' },
    contact: { limit: 3, window: '60 s' },
    discount: { limit: 5, window: '60 s' },
};

const limiters: Record<string, Ratelimit> = {};
const inMemoryRateLimitStore = new Map<string, { count: number; reset: number }>();

function parseWindowMs(window: string): number {
    const match = window.trim().match(/^(\d+)\s*([smhd])$/i);
    if (!match) {
        return 60_000;
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
        s: 1_000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
    };

    return value * (multipliers[unit] ?? 60_000);
}

function runInMemoryLimit(config: RateLimitConfig, type: keyof typeof LIMIT_CONFIGS, identifier: string) {
    const now = Date.now();
    const windowMs = parseWindowMs(config.window);
    const key = `${type}:${identifier}`;
    const existing = inMemoryRateLimitStore.get(key);

    if (!existing || now >= existing.reset) {
        const reset = now + windowMs;
        const next = { count: 1, reset };
        inMemoryRateLimitStore.set(key, next);
        return {
            success: true,
            remaining: Math.max(config.limit - next.count, 0),
            limit: config.limit,
            reset,
        };
    }

    existing.count += 1;
    return {
        success: existing.count <= config.limit,
        remaining: Math.max(config.limit - existing.count, 0),
        limit: config.limit,
        reset: existing.reset,
    };
}

if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
        for (const [key, config] of Object.entries(LIMIT_CONFIGS)) {
            limiters[key] = new Ratelimit({
                redis: kv,
                limiter: Ratelimit.slidingWindow(config.limit, config.window),
                analytics: true,
                prefix: `ratelimit:genie:${key}`,
            });
        }
    } catch (err) {
        console.error('Failed to initialize Rate Limiters:', err);
    }
} else {
    if (process.env.NODE_ENV !== 'test') {
        console.warn('[RateLimiter] Vercel KV environment variables (KV_REST_API_URL / KV_REST_API_TOKEN) are missing. Falling back to per-instance in-memory rate limiting.');
    }
}

export async function checkRateLimit(
    type: 'ai' | 'newsletter' | 'contact' | 'discount',
    identifier: string
) {
    const config = LIMIT_CONFIGS[type];
    const limiter = limiters[type];
    if (!limiter) {
        return runInMemoryLimit(config, type, identifier);
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
        console.error(`Rate limit check failed for ${type}, falling back to in-memory limiter:`, err);
        return runInMemoryLimit(config, type, identifier);
    }
}
