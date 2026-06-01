export type WithQuotaRetryOptions = {
    maxAttempts?: number;
    baseBackoffMs?: number;
    jitterMs?: number;
    onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
    sleep?: (ms: number) => Promise<void>;
};

const QUOTA_ERROR_PATTERN = /RESOURCE_EXHAUSTED|check quota|quota|rate limit|too many requests|"code"\s*:\s*429/i;

export function isQuotaLikeError(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === 'object' && 'status' in error) {
        const status = Number((error as { status?: unknown }).status);
        if (status === 429) return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    return QUOTA_ERROR_PATTERN.test(message);
}

export function computeBackoffMs(attempt: number, baseBackoffMs: number, jitterMs: number): number {
    const exponential = Math.pow(2, attempt) * baseBackoffMs;
    const jitter = Math.random() * jitterMs;
    return Math.round(exponential + jitter);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withQuotaRetry<T>(
    fn: () => Promise<T>,
    options: WithQuotaRetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseBackoffMs = 4000,
        jitterMs = 2000,
        onRetry,
        sleep = defaultSleep,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const hasRetriesLeft = attempt < maxAttempts;
            if (!hasRetriesLeft || !isQuotaLikeError(error)) {
                throw error;
            }

            const delayMs = computeBackoffMs(attempt, baseBackoffMs, jitterMs);
            if (onRetry) {
                onRetry({ attempt: attempt + 1, delayMs, error });
            }
            await sleep(delayMs);
        }
    }

    throw lastError;
}
