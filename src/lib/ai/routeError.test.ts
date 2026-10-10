import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeAiRouteError } from '@/lib/ai/routeError';

const options = {
  defaultMessage: 'Failed to analyze image',
  quotaMessage: 'Quota exceeded',
};

function errorWithCause(message: string, causeMessage: string) {
  const error = Object.assign(new Error(message), {
    name: 'CakeAnalysisResponseError',
    status: 502,
  });
  Object.defineProperty(error, 'cause', { value: new Error(causeMessage) });
  return error;
}

describe('normalizeAiRouteError', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('surfaces the nested validation cause during local development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(normalizeAiRouteError(
      errorWithCause('Invalid response format from AI', 'analysis.main_toppers[0].box_2d must contain exactly 2 boxes'),
      options,
    )).toMatchObject({
      status: 502,
      message: 'Invalid response format from AI: analysis.main_toppers[0].box_2d must contain exactly 2 boxes',
    });
  });

  it('keeps nested validation details out of non-development responses', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(normalizeAiRouteError(
      errorWithCause('Invalid response format from AI', 'analysis.main_toppers[0].box_2d must contain exactly 2 boxes'),
      options,
    )).toMatchObject({
      status: 502,
      message: 'The AI response could not be validated. Please try again.',
    });
  });

  it('maps AbortSignal timeout errors to 504', () => {
    const error = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

    expect(normalizeAiRouteError(error, options)).toMatchObject({ status: 504 });
  });

  it('preserves known authorization statuses', () => {
    for (const status of [401, 403]) {
      const error = Object.assign(new Error('provider authorization failure'), { status });

      expect(normalizeAiRouteError(error, options).status).toBe(status);
    }
  });

  it('maps provider quota exhaustion to 429', () => {
    const error = Object.assign(new Error('provider quota exhausted'), { status: 429 });

    expect(normalizeAiRouteError(error, options)).toMatchObject({ status: 429, message: options.quotaMessage });
  });

  it('maps Gemini provider 5xx errors to 502 without exposing provider details', () => {
    const error = Object.assign(new Error('Internal service details'), {
      name: 'InternalServerError',
      status: 500,
      headers: new Headers(),
      error: { message: 'private provider detail' },
    });

    expect(normalizeAiRouteError(error, options)).toEqual({
      status: 502,
      message: 'AI cake analysis could not be completed because the AI service returned an error. Please retry.',
    });
  });

  it('maps provider service-unavailable errors to 503', () => {
    const error = Object.assign(new Error('temporarily unavailable'), {
      status: 503,
      headers: new Headers(),
      error: { message: 'temporarily unavailable' },
    });

    expect(normalizeAiRouteError(error, options)).toMatchObject({ status: 503 });
  });

  it('keeps unexpected application faults as 500 with the route fallback message', () => {
    expect(normalizeAiRouteError(new Error('unexpected implementation bug'), options)).toEqual({
      status: 500,
      message: 'Failed to analyze image',
    });
  });

  it('does not trust an unclassified application error just because it carries an HTTP-like status', () => {
    const error = Object.assign(new Error('unexpected application error'), { status: 400 });

    expect(normalizeAiRouteError(error, options)).toEqual({
      status: 500,
      message: 'Failed to analyze image',
    });
  });

  it('maps AI client initialization failures to 503', () => {
    expect(normalizeAiRouteError(new Error('Failed to initialize AI service. Please try again later.'), options))
      .toMatchObject({ status: 503 });
  });
});
