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
    if (error instanceof Error) return error.message;
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

export function normalizeAiRouteError(
    error: unknown,
    { defaultMessage, quotaMessage, authorizationMessage }: NormalizeAiRouteErrorOptions,
): NormalizedAiRouteError {
    const status = getErrorStatus(error);
    const rawMessage = getErrorMessage(error).trim();
    const safeMessage = rawMessage && rawMessage !== '[object Object]' ? rawMessage : defaultMessage;
    const providerError = getProviderError(rawMessage);
    const quotaLike = status === 429 || isQuotaErrorMessage(safeMessage);
    const authLike = status === 401 || status === 403 || isAuthorizationErrorMessage(safeMessage);

    logAiRouteDiagnostics({
        rawStatus: status,
        normalizedHint: quotaLike ? 'quota' : authLike ? 'auth' : 'other',
        providerCode: providerError?.code,
        providerStatus: providerError?.status,
        providerMessage: providerError?.message,
        rawMessage: safeMessage,
    });

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

    return {
        status: status && status >= 400 && status < 600 ? status : 500,
        message: safeMessage,
    };
}
