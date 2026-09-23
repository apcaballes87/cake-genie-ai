interface NormalizeAiRouteErrorOptions {
    defaultMessage: string;
    quotaMessage: string;
    authorizationMessage?: string;
}

interface NormalizedAiRouteError {
    status: number;
    message: string;
}

function logAiRouteDiagnostics(details: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    console.error('[AI Route Diagnostics]', details);
}

function getErrorStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'status' in error) {
        const status = Number((error as { status?: unknown }).status);
        if (Number.isInteger(status)) return status;
    }

    const providerStatus = getProviderError(getErrorMessage(error))?.code;
    return Number.isInteger(providerStatus) ? providerStatus : undefined;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        if (process.env.NODE_ENV === 'development') {
            const cause = (error as Error & { cause?: unknown }).cause;
            if (cause instanceof Error && cause.message) return `${error.message}: ${cause.message}`;
        }
        return error.message;
    }
    return String(error);
}

function getProviderError(message: string): { code?: number; status?: string; message?: string } | null {
    try {
        const parsed = JSON.parse(message) as {
            error?: { code?: number; status?: string; message?: string };
        };
        return parsed.error ?? null;
    } catch {
        return null;
    }
}

function isQuotaErrorMessage(message: string): boolean {
    return /RESOURCE_EXHAUSTED|check quota|quota|rate limit|too many requests|"code"\s*:\s*429/i.test(message);
}

function isAuthorizationErrorMessage(message: string): boolean {
    return /PERMISSION_DENIED|UNAUTHENTICATED|denied access|forbidden|unauthorized|invalid api key|api key not valid|"code"\s*:\s*(401|403)/i.test(message);
}

function isProviderApiError(error: unknown, providerError: { code?: number } | null): boolean {
    if (providerError) return true;
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { name?: unknown; status?: unknown; headers?: unknown; error?: unknown };
    return candidate.name === 'ApiError'
        || candidate.name === 'APIError'
        || (typeof candidate.status === 'number' && 'headers' in candidate && 'error' in candidate);
}

function isProviderConnectionError(error: unknown, message: string): boolean {
    if (error && typeof error === 'object') {
        const name = (error as { name?: unknown }).name;
        if (name === 'APIConnectionError' || name === 'APIConnectionTimeoutError') return true;
        const code = (error as { code?: unknown }).code;
        if (typeof code === 'string' && /^(ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT)$/.test(code)) {
            return true;
        }
    }
    return /^(connection error\.|failed to fetch\b|fetch failed\b|socket hang up\b)/i.test(message);
}

function isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    if (error instanceof Error && ['AbortError', 'TimeoutError', 'APIConnectionTimeoutError'].includes(error.name)) return true;
    const code = (error as { code?: unknown }).code;
    if (code === 'ABORT_ERR' || code === 'ERR_ABORTED' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') return true;
    return error instanceof Error && /request timed out|operation was aborted due to timeout/i.test(error.message);
}

export function normalizeAiRouteError(
    error: unknown,
    { defaultMessage, quotaMessage, authorizationMessage }: NormalizeAiRouteErrorOptions,
): NormalizedAiRouteError {
    const status = getErrorStatus(error);
    const rawMessage = getErrorMessage(error).trim();
    const safeMessage = rawMessage && rawMessage !== '[object Object]' ? rawMessage : defaultMessage;
    const providerError = getProviderError(rawMessage);
    const providerApiError = isProviderApiError(error, providerError);
    const quotaLike = status === 429 || isQuotaErrorMessage(safeMessage);
    const authLike = status === 401 || status === 403 || isAuthorizationErrorMessage(safeMessage);
    const timeoutLike = isAbortError(error)
        || (providerApiError && (status === 408 || status === 504));
    const unavailableLike = /failed to initialize ai service|ai service is temporarily unavailable/i.test(safeMessage)
        || isProviderConnectionError(error, safeMessage);

    logAiRouteDiagnostics({
        rawStatus: status,
        normalizedHint: quotaLike ? 'quota' : authLike ? 'auth' : timeoutLike ? 'timeout' : providerApiError ? 'provider' : unavailableLike ? 'unavailable' : 'other',
        providerCode: providerError?.code,
        providerStatus: providerError?.status,
        providerMessage: providerError?.message,
        rawMessage: safeMessage,
    });

    if (timeoutLike) {
        return {
            status: 504,
            message: 'AI request timed out before the model finished responding. Please retry with a smaller or different image.',
        };
    }

    if (quotaLike) {
        return {
            status: 429,
            message: quotaMessage,
        };
    }

    if (authLike) {
        return {
            status: status === 401 ? 401 : 403,
            message: authorizationMessage ?? 'AI service is not authorized. Please check the AI provider configuration and try again.',
        };
    }

    if (error instanceof Error && ['CakeAnalysisResponseError', 'GeneratedAnalysisContractError'].includes(error.name)) {
        return {
            status: 502,
            message: process.env.NODE_ENV === 'development'
                ? safeMessage
                : 'The AI response could not be validated. Please try again.',
        };
    }

    if (error instanceof Error && error.name === 'CakeAnalysisRequestError'
        && (status === 400 || status === 413 || status === 415)) {
        return { status, message: safeMessage };
    }

    if (unavailableLike || (providerApiError && status === 503)) {
        return {
            status: 503,
            message: 'AI cake analysis is temporarily unavailable. Please try again later.',
        };
    }

    if (providerApiError && status !== undefined) {
        if (status >= 500 || status === 404) {
            return {
                status: 502,
                message: 'AI cake analysis could not be completed because the AI service returned an error. Please retry.',
            };
        }
        if (status >= 400 && status < 500) {
            return {
                status,
                message: 'The AI service could not process this image request. Check the image and try again.',
            };
        }
    }

    return {
        status: 500,
        message: defaultMessage,
    };
}
