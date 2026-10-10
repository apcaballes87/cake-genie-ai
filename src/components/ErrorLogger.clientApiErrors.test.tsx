import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorLogger from './ErrorLogger';
import { CLIENT_API_ERROR_EVENT, type ClientApiErrorReport } from '@/lib/clientApiErrors';

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    from: vi.fn(),
    insert: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: mocks.createClient,
}));

describe('ErrorLogger client API errors', () => {
    let sessionStorageDescriptor: PropertyDescriptor | undefined;

    beforeEach(() => {
        mocks.insert.mockReset().mockResolvedValue({ error: null });
        mocks.from.mockReset().mockReturnValue({ insert: mocks.insert });
        mocks.createClient.mockReset().mockReturnValue({ from: mocks.from });
    });

    afterEach(() => {
        if (sessionStorageDescriptor) {
            Object.defineProperty(window, 'sessionStorage', sessionStorageDescriptor);
            sessionStorageDescriptor = undefined;
        } else if (Object.getOwnPropertyDescriptor(window, 'sessionStorage')?.get) {
            Reflect.deleteProperty(window, 'sessionStorage');
        }
        vi.restoreAllMocks();
    });

    it('stores the server failure and request metadata in client_errors', async () => {
        const { unmount } = render(<ErrorLogger />);
        const report: ClientApiErrorReport = {
            endpoint: '/api/ai/analyze',
            method: 'POST',
            status: 500,
            message: 'Invalid generated cake analysis: integrated bbox geometry is invalid',
            stack: 'Error: response failed\n    at analyzeCakeFeaturesOnly',
        };

        await act(async () => {
            window.dispatchEvent(new CustomEvent(CLIENT_API_ERROR_EVENT, { detail: report }));
        });

        await waitFor(() => {
            const payload = mocks.insert.mock.calls
                .flatMap(([rows]) => rows as Array<Record<string, unknown>>)
                .find((row) => row.error_type === 'api_error');
            expect(payload).toMatchObject({
                error_type: 'api_error',
                error_message: 'POST /api/ai/analyze returned HTTP 500: Invalid generated cake analysis: integrated bbox geometry is invalid',
                error_stack: report.stack,
                page_path: window.location.pathname,
                session_id: expect.any(String),
                metadata: {
                    source: 'client_api_error',
                    endpoint: '/api/ai/analyze',
                    method: 'POST',
                    status: 500,
                },
            });
        });

        unmount();
    });

    it('still listens and reports when sessionStorage access is blocked', async () => {
        sessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get: () => { throw new DOMException('Storage is unavailable', 'SecurityError'); },
        });

        const { unmount } = render(<ErrorLogger />);
        const report: ClientApiErrorReport = {
            endpoint: '/api/ai/analyze',
            method: 'POST',
            status: 500,
            message: 'Invalid generated cake analysis',
        };

        await act(async () => {
            window.dispatchEvent(new CustomEvent(CLIENT_API_ERROR_EVENT, { detail: report }));
        });

        await waitFor(() => {
            const payload = mocks.insert.mock.calls
                .flatMap(([rows]) => rows as Array<Record<string, unknown>>)
                .find((row) => row.error_type === 'api_error');
            expect(payload?.session_id).toEqual(expect.any(String));
        });

        unmount();
    });
});
