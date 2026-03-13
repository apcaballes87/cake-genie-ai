import { describe, expect, it } from 'vitest';
import { withTimeout } from './timeout';

describe('withTimeout', () => {
  it('resolves if the promise resolves before the timeout', async () => {
    const promise = new Promise((resolve) => setTimeout(() => resolve('success'), 10));

    const result = await withTimeout(promise, 50, 'Timeout error');

    expect(result).toBe('success');
  });

  it('rejects if the promise takes longer than the timeout', async () => {
    const promise = new Promise((resolve) => setTimeout(() => resolve('success'), 50));

    await expect(withTimeout(promise, 10, 'Custom timeout message')).rejects.toThrow('Custom timeout message');
  });

  it('rejects with the original error if the promise rejects before the timeout', async () => {
    const promise = new Promise((_, reject) => setTimeout(() => reject(new Error('Original error')), 10));

    await expect(withTimeout(promise, 50, 'Timeout error')).rejects.toThrow('Original error');
  });
});
