import { describe, expect, it, vi } from 'vitest';

vi.mock('./contribute/[orderId]/ContributeClient', () => ({ default: () => null }));

describe('private flow metadata', () => {
  it('keeps order confirmation, contributions, and password recovery out of search', async () => {
    const [{ metadata: order }, { metadata: contribute }, { metadata: setPassword }, { metadata: forgotPassword }] = await Promise.all([
      import('./order-confirmation/layout'),
      import('./contribute/[orderId]/page'),
      import('./auth/set-password/layout'),
      import('./forgot-password/page'),
    ]);

    for (const metadata of [order, contribute, setPassword, forgotPassword]) {
      expect(metadata.robots).toEqual(expect.objectContaining({ index: false, follow: false }));
      expect(metadata.alternates?.canonical).toBeUndefined();
    }
  });
});
