import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeBackoffMs, isQuotaLikeError, withQuotaRetry } from './withQuotaRetry';

describe('isQuotaLikeError', () => {
    it('matches when status is exactly 429', () => {
        const error = Object.assign(new Error('whatever'), { status: 429 });
        expect(isQuotaLikeError(error)).toBe(true);
    });

    it('ignores a non-numeric, non-quota status string', () => {
        const error = Object.assign(new Error('whatever'), { status: 'forbidden' });
        expect(isQuotaLikeError(error)).toBe(false);
    });

    it('coerces a numeric status string of 429 to a quota match', () => {
        const error = Object.assign(new Error('whatever'), { status: '429' });
        expect(isQuotaLikeError(error)).toBe(true);
    });

    it('matches RESOURCE_EXHAUSTED in message body', () => {
        const error = new Error('{"error":{"code":429,"message":"Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED"}}');
        expect(isQuotaLikeError(error)).toBe(true);
    });

    it('matches "rate limit" phrasing', () => {
        const error = new Error('AI service rate limit reached, please retry');
        expect(isQuotaLikeError(error)).toBe(true);
    });

    it('matches "too many requests" phrasing', () => {
        const error = new Error('Too many requests, please try again later');
        expect(isQuotaLikeError(error)).toBe(true);
    });

    it('does not match an unrelated error message', () => {
        const error = new Error('INVALID_ARGUMENT: image dimensions are wrong');
        expect(isQuotaLikeError(error)).toBe(false);
    });

    it('does not match a 500 server error', () => {
        const error = Object.assign(new Error('server blew up'), { status: 500 });
        expect(isQuotaLikeError(error)).toBe(false);
    });

    it('returns false for null/undefined input', () => {
        expect(isQuotaLikeError(null)).toBe(false);
        expect(isQuotaLikeError(undefined)).toBe(false);
    });

    it('handles non-Error throwables via String() coercion', () => {
        expect(isQuotaLikeError('quota exceeded')).toBe(true);
        expect(isQuotaLikeError(42)).toBe(false);
    });
});

describe('computeBackoffMs', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('doubles the base backoff per attempt with no jitter', () => {
        expect(computeBackoffMs(0, 1000, 0)).toBe(1000);
        expect(computeBackoffMs(1, 1000, 0)).toBe(2000);
        expect(computeBackoffMs(2, 1000, 0)).toBe(4000);
    });

    it('returns an integer', () => {
        expect(Number.isInteger(computeBackoffMs(0, 4000, 2000))).toBe(true);
        expect(Number.isInteger(computeBackoffMs(3, 4000, 2000))).toBe(true);
    });
});

describe('withQuotaRetry', () => {
    let sleepMock: (ms: number) => Promise<void>;

    beforeEach(() => {
        sleepMock = vi.fn().mockResolvedValue(undefined) as unknown as (ms: number) => Promise<void>;
    });

    it('resolves with the function result on first success', async () => {
        const fn = vi.fn().mockResolvedValue('ok');

        const result = await withQuotaRetry(fn, { sleep: sleepMock });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(sleepMock).not.toHaveBeenCalled();
    });

    it('retries up to maxAttempts on quota-shaped errors and returns the eventual success', async () => {
        const quotaError = new Error('RESOURCE_EXHAUSTED');
        const fn = vi
            .fn()
            .mockRejectedValueOnce(quotaError)
            .mockRejectedValueOnce(quotaError)
            .mockResolvedValueOnce('eventually-ok');

        const onRetry = vi.fn();
        const result = await withQuotaRetry(fn, {
            maxAttempts: 3,
            baseBackoffMs: 1000,
            jitterMs: 0,
            onRetry,
            sleep: sleepMock,
        });

        expect(result).toBe('eventually-ok');
        expect(fn).toHaveBeenCalledTimes(3);
        expect(sleepMock).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenNthCalledWith(1, expect.objectContaining({ attempt: 1 }));
        expect(onRetry).toHaveBeenNthCalledWith(2, expect.objectContaining({ attempt: 2 }));
    });

    it('uses exponential backoff delays between retries', async () => {
        const quotaError = new Error('RESOURCE_EXHAUSTED');
        const fn = vi
            .fn()
            .mockRejectedValueOnce(quotaError)
            .mockRejectedValueOnce(quotaError)
            .mockResolvedValueOnce('ok');

        await withQuotaRetry(fn, {
            maxAttempts: 3,
            baseBackoffMs: 1000,
            jitterMs: 0,
            sleep: sleepMock,
        });

        expect(sleepMock).toHaveBeenNthCalledWith(1, 1000);
        expect(sleepMock).toHaveBeenNthCalledWith(2, 2000);
    });

    it('re-throws when all attempts are exhausted', async () => {
        const quotaError = new Error('RESOURCE_EXHAUSTED');
        const fn = vi.fn().mockRejectedValue(quotaError);

        await expect(
            withQuotaRetry(fn, {
                maxAttempts: 2,
                baseBackoffMs: 1,
                jitterMs: 0,
                sleep: sleepMock,
            })
        ).rejects.toBe(quotaError);

        expect(fn).toHaveBeenCalledTimes(3);
        expect(sleepMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-quota errors and re-throws immediately', async () => {
        const badError = new Error('INVALID_ARGUMENT: bad image');
        const fn = vi.fn().mockRejectedValue(badError);

        await expect(
            withQuotaRetry(fn, {
                maxAttempts: 3,
                baseBackoffMs: 1,
                jitterMs: 0,
                sleep: sleepMock,
            })
        ).rejects.toBe(badError);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(sleepMock).not.toHaveBeenCalled();
    });

    it('detects quota errors via numeric status: 429', async () => {
        const statusError = Object.assign(new Error('generic'), { status: 429 });
        const fn = vi
            .fn()
            .mockRejectedValueOnce(statusError)
            .mockResolvedValueOnce('ok');

        const result = await withQuotaRetry(fn, {
            maxAttempts: 2,
            baseBackoffMs: 1,
            jitterMs: 0,
            sleep: sleepMock,
        });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(sleepMock).toHaveBeenCalledTimes(1);
    });

    it('respects maxAttempts: 0 by attempting once and re-throwing', async () => {
        const quotaError = new Error('RESOURCE_EXHAUSTED');
        const fn = vi.fn().mockRejectedValue(quotaError);

        await expect(
            withQuotaRetry(fn, {
                maxAttempts: 0,
                baseBackoffMs: 1,
                jitterMs: 0,
                sleep: sleepMock,
            })
        ).rejects.toBe(quotaError);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(sleepMock).not.toHaveBeenCalled();
    });

    it('uses real setTimeout sleep when no sleep option is provided', async () => {
        const quotaError = new Error('RESOURCE_EXHAUSTED');
        const fn = vi
            .fn()
            .mockRejectedValueOnce(quotaError)
            .mockResolvedValueOnce('ok');

        const result = await withQuotaRetry(fn, {
            maxAttempts: 1,
            baseBackoffMs: 1,
            jitterMs: 0,
        });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
