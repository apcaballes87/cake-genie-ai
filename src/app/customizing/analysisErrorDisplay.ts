const AI_SERVICE_OUTAGE_PATTERN =
    /AI .*?(temporarily unavailable|not authorized)|quota|rate limit|Vertex AI|Workload Identity/i;

export function isAiServiceOutageError(error: string | null | undefined): boolean {
    return Boolean(error && AI_SERVICE_OUTAGE_PATTERN.test(error));
}

export function getCustomerFacingAnalysisError(error: string): {
    title: string;
    message: string;
    isServiceOutage: boolean;
} {
    if (isAiServiceOutageError(error)) {
        return {
            title: 'AI Service Temporarily Offline',
            message: 'Please browse or search our cake design gallery while the service recovers.',
            isServiceOutage: true,
        };
    }

    const isRejection = error.startsWith('AI_REJECTION:');

    return {
        title: isRejection ? 'Image Rejected' : 'Update Failed',
        message: error.replace('AI_REJECTION: ', ''),
        isServiceOutage: false,
    };
}
