import { describe, expect, it } from 'vitest';

import {
  classifyDirectRerunError,
  extractDirectRerunProviderError,
  isDirectRerunQuotaError,
  serializeDirectRerunError,
} from './directRerunError';

describe('direct rerun error diagnostics', () => {
  it('extracts a provider 500 from the Vertex error payload', () => {
    const error = new Error(JSON.stringify({
      error: {
        code: 500,
        message: 'Internal error encountered.',
        status: 'INTERNAL',
      },
    }));

    expect(classifyDirectRerunError(error)).toEqual({ stage: 'provider', retryable: true });
    expect(extractDirectRerunProviderError(error)).toMatchObject({
      code: 500,
      message: 'Internal error encountered.',
      status: 'INTERNAL',
    });
    expect(serializeDirectRerunError(error)).toMatchObject({
      stage: 'provider',
      retryable: true,
      provider_error: {
        code: 500,
        status: 'INTERNAL',
      },
    });
    expect(isDirectRerunQuotaError(error)).toBe(false);
  });

  it('marks quota exhaustion as a retryable provider error', () => {
    const error = new Error(JSON.stringify({
      error: {
        code: 429,
        message: 'Resource exhausted.',
        status: 'RESOURCE_EXHAUSTED',
      },
    }));

    expect(classifyDirectRerunError(error)).toEqual({ stage: 'provider', retryable: true });
    expect(isDirectRerunQuotaError(error)).toBe(true);
  });

  it('preserves invalid model output and its validation cause', () => {
    const error = Object.assign(new Error('Generated analysis failed validation.'), {
      name: 'CakeAnalysisResponseError',
      rawResponse: '{"cakeType":"birthday_cake"}',
      cause: Object.assign(new Error('Wrong exact box count.'), {
        name: 'GeneratedAnalysisContractError',
      }),
    });

    expect(classifyDirectRerunError(error)).toEqual({
      stage: 'analysis_validation',
      retryable: false,
    });
    expect(serializeDirectRerunError(error)).toMatchObject({
      name: 'CakeAnalysisResponseError',
      stage: 'analysis_validation',
      raw_response: '{"cakeType":"birthday_cake"}',
      cause: {
        name: 'GeneratedAnalysisContractError',
        stage: 'analysis_validation',
      },
    });
  });

  it('distinguishes image and database failures', () => {
    expect(classifyDirectRerunError(new Error('image fetch failed (404)'))).toEqual({
      stage: 'image_fetch',
      retryable: false,
    });
    expect(classifyDirectRerunError(new Error('analysis_json update failed: timeout'))).toEqual({
      stage: 'database_write',
      retryable: false,
    });
  });
});
