import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetAllPromptVersions = vi.fn();
const mockCreateAdminServerSupabaseClient = vi.fn();

vi.mock('@/services/prompts/promptLoader', () => ({
    getAllPromptVersions: (...args: unknown[]) => mockGetAllPromptVersions(...args),
}));

vi.mock('@/lib/supabase/adminServer', () => ({
    createAdminServerSupabaseClient: () => mockCreateAdminServerSupabaseClient(),
}));

vi.mock('@/lib/admin/imageStudio', () => ({
    ADMIN_IMAGE_STUDIO_PIN: '231323',
}));

describe('/api/admin/ai-prompts', () => {
    beforeEach(() => {
        vi.resetModules();
        mockGetAllPromptVersions.mockReset();
        mockCreateAdminServerSupabaseClient.mockReset();
    });

    it('rejects requests without the admin pin', async () => {
        const { GET } = await import('./route');
        const response = await GET(new NextRequest('http://localhost/api/admin/ai-prompts'));

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Unauthorized' });
        expect(mockGetAllPromptVersions).not.toHaveBeenCalled();
    });

    it('returns all prompt versions with the admin pin', async () => {
        const versions = [
            { id: '1', version: '3.35', is_active: true, created_at: '2026-07-01T00:00:00.000Z' },
            { id: '2', version: '3.32', is_active: false, created_at: '2026-06-01T00:00:00.000Z' },
            { id: '3', version: '3.11', is_active: false, created_at: '2026-05-01T00:00:00.000Z' },
        ];
        mockGetAllPromptVersions.mockResolvedValue(versions);
        mockCreateAdminServerSupabaseClient.mockReturnValue({});

        const { GET } = await import('./route');
        const request = new NextRequest('http://localhost/api/admin/ai-prompts', {
            headers: { 'x-admin-pin': '231323' },
        });

        const response = await GET(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toEqual(versions);
        expect(body.total).toBe(3);
        expect(mockGetAllPromptVersions).toHaveBeenCalled();
    });

    it('returns an empty list when no versions exist', async () => {
        mockGetAllPromptVersions.mockResolvedValue([]);
        mockCreateAdminServerSupabaseClient.mockReturnValue({});

        const { GET } = await import('./route');
        const request = new NextRequest('http://localhost/api/admin/ai-prompts', {
            headers: { 'x-admin-pin': '231323' },
        });

        const response = await GET(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toEqual([]);
        expect(body.total).toBe(0);
    });
});
