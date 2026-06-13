import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getProxyAwareImageUrl,
  isSiteOwnedSupabasePublicImageUrl,
  shouldBypassImageProxy,
} from './imageSelection';

describe('imageSelection proxy helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects Genie-owned public Supabase assets', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

    expect(
      isSiteOwnedSupabasePublicImageUrl('https://project.supabase.co/storage/v1/object/public/cakegenie/cake.webp')
    ).toBe(true);
    expect(
      isSiteOwnedSupabasePublicImageUrl('https://images.example.com/cake.webp')
    ).toBe(false);
  });

  it('bypasses the proxy for first-party, data, blob, and test fixture URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

    expect(
      shouldBypassImageProxy('https://project.supabase.co/storage/v1/object/public/cakegenie/cake.webp')
    ).toBe(true);
    expect(shouldBypassImageProxy('data:image/png;base64,abc')).toBe(true);
    expect(shouldBypassImageProxy('blob:http://localhost/image')).toBe(true);
    expect(shouldBypassImageProxy('https://example.com/cake.webp')).toBe(true);
    expect(shouldBypassImageProxy('https://images.example.org/cake.webp')).toBe(false);
  });

  it('keeps third-party images on the proxy path', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

    expect(
      getProxyAwareImageUrl('https://images.example.org/cake.webp')
    ).toBe('/api/proxy-image?url=https%3A%2F%2Fimages.example.org%2Fcake.webp');
    expect(
      getProxyAwareImageUrl('https://project.supabase.co/storage/v1/object/public/cakegenie/cake.webp')
    ).toBe('https://project.supabase.co/storage/v1/object/public/cakegenie/cake.webp');
  });
});
