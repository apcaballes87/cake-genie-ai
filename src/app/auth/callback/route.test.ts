import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

describe('GET /auth/callback', () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset();
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    mocks.createClient.mockReset();
    mocks.createClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
    });
  });

  it('preserves the customizer path and query parameters after code exchange', async () => {
    const { GET } = await import('./route');
    const response = await GET(new NextRequest(
      'https://genie.ph/auth/callback?code=abc&next=%2Fcustomizing%2Fexample%3Fsize%3D8',
    ));

    expect(response.headers.get('location')).toBe('https://genie.ph/customizing/example?size=8');
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('defaults to the landing page when next is missing', async () => {
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('https://genie.ph/auth/callback?code=abc'));

    expect(response.headers.get('location')).toBe('https://genie.ph/');
  });

  it('rejects external next targets', async () => {
    const { GET } = await import('./route');
    const response = await GET(new NextRequest(
      'https://genie.ph/auth/callback?next=https%3A%2F%2Fevil.example%2F',
    ));

    expect(response.headers.get('location')).toBe('https://genie.ph/');
  });
});
