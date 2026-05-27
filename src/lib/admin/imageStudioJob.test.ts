import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { persistStudioUpdateWithRetry } from './imageStudioJob';

function createSupabaseClientWithUpdateResults(results: Array<{ data: unknown; error: unknown }>) {
    const maybeSingle = vi.fn();

    for (const result of results) {
        maybeSingle.mockResolvedValueOnce(result);
    }

    const select = vi.fn(() => ({
        maybeSingle,
    }));
    const eq = vi.fn(() => ({
        select,
    }));
    const update = vi.fn(() => ({
        eq,
    }));
    const from = vi.fn(() => ({
        update,
    }));

    return {
        client: {
            from,
        } as unknown as SupabaseClient,
        maybeSingle,
        select,
        eq,
        update,
        from,
    };
}

describe('persistStudioUpdateWithRetry', () => {
    it('returns immediately when the cache row already exists', async () => {
        const { client, maybeSingle, update } = createSupabaseClientWithUpdateResults([
            {
                data: { p_hash: 'abc123', studio_edit_status: 'completed' },
                error: null,
            },
        ]);

        const result = await persistStudioUpdateWithRetry(
            client,
            'abc123',
            {
                studio_edit_status: 'completed',
                studio_edit_error: null,
            }
        );

        expect(result).toEqual({ p_hash: 'abc123', studio_edit_status: 'completed' });
        expect(update).toHaveBeenCalledTimes(1);
        expect(maybeSingle).toHaveBeenCalledTimes(1);
    });

    it('polls until the cache row exists when waitForRow is enabled', async () => {
        const { client, maybeSingle, update } = createSupabaseClientWithUpdateResults([
            { data: null, error: null },
            { data: null, error: null },
            {
                data: { p_hash: 'def456', studio_edit_status: 'completed' },
                error: null,
            },
        ]);

        const result = await persistStudioUpdateWithRetry(
            client,
            'def456',
            {
                studio_edit_status: 'completed',
                studio_edit_error: null,
            },
            {
                waitForRow: true,
                maxAttempts: 3,
                waitMs: 0,
            }
        );

        expect(result).toEqual({ p_hash: 'def456', studio_edit_status: 'completed' });
        expect(update).toHaveBeenCalledTimes(3);
        expect(maybeSingle).toHaveBeenCalledTimes(3);
    });
});
