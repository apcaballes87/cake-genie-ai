import { describe, expect, it } from 'vitest';
import { getCustomerFacingAnalysisError, isAiServiceOutageError } from './analysisErrorDisplay';

describe('isAiServiceOutageError', () => {
    it.each([
        'AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration.',
        'AI cake analysis is temporarily unavailable due to quota limits.',
        'AI service rate limit reached.',
    ])('classifies provider availability failures: %s', (message) => {
        expect(isAiServiceOutageError(message)).toBe(true);
    });

    it('does not classify a cake image rejection as a provider outage', () => {
        expect(isAiServiceOutageError('AI_REJECTION: Please upload a single cake image.')).toBe(false);
    });

    it('replaces provider details with customer-safe hero copy', () => {
        expect(getCustomerFacingAnalysisError(
            'AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration.'
        )).toEqual({
            title: 'AI Service Temporarily Offline',
            message: 'Please browse or search our cake design gallery while the service recovers.',
            isServiceOutage: true,
        });
    });
});
