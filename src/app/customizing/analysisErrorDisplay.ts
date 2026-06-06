const AI_SERVICE_OUTAGE_PATTERN =
    /AI .*?(temporarily unavailable|not authorized)|quota|rate limit|Vertex AI|Workload Identity/i;

export function isAiServiceOutageError(error: string | null | undefined): boolean {
    return Boolean(error && AI_SERVICE_OUTAGE_PATTERN.test(error));
}
