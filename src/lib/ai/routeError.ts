interface NormalizeAiRouteErrorOptions {
    defaultMessage: string;
    quotaMessage: string;
}

interface NormalizedAiRouteError {
    status: number;
    message: string;
}

function getErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('status' in error)) {
        return undefined;
    }

    const status = Number((error as { status?: unknown }).status);
    return Number.isInteger(status) ? status : undefined;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function isQuotaErrorMessage(message: string): boolean {
    return /RESOURCE_EXHAUSTED|check quota|quota|rate limit|too many requests|"code"\s*:\s*429/i.test(message);
}

export function normalizeAiRouteError(
    error: unknown,
    { defaultMessage, quotaMessage }: NormalizeAiRouteErrorOptions,
): NormalizedAiRouteError {
    const status = getErrorStatus(error);
    const rawMessage = getErrorMessage(error).trim();
    const safeMessage = rawMessage && rawMessage !== '[object Object]' ? rawMessage : defaultMessage;

    if (status === 429 || isQuotaErrorMessage(safeMessage)) {
        return {
            status: 429,
            message: quotaMessage,
        };
    }

    return {
        status: status && status >= 400 && status < 600 ? status : 500,
        message: safeMessage,
    };
}