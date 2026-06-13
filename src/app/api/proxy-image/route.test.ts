import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('GET /api/proxy-image', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('redirects Genie-owned public Supabase assets instead of proxying them', async () => {
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const { GET } = await import('./route');

        const response = await GET(
            new NextRequest(
                'http://localhost/api/proxy-image?url=https%3A%2F%2Fproject.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fcakegenie%2Fimage.webp'
            )
        );

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://project.supabase.co/storage/v1/object/public/cakegenie/image.webp'
        );
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects requests that omit the url parameter', async () => {
        const { GET } = await import('./route');

        const response = await GET(new NextRequest('http://localhost/api/proxy-image'));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'URL parameter is required',
        });
    });
});
