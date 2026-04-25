import { beforeEach, describe, expect, it, vi } from 'vitest';

const writeFileSync = vi.fn();
const existsSync = vi.fn();
const GoogleGenAI = vi.fn();

vi.mock('fs', () => ({
    default: {
        existsSync,
        writeFileSync,
    },
}));

vi.mock('@google/genai', () => ({
    GoogleGenAI,
}));

describe('getAI', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        existsSync.mockReturnValue(false);
    });

    it('initializes Vertex AI with WIF credentials and the Vercel OIDC token', async () => {
        const credentials = {
            type: 'external_account',
            audience: '//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/vercel-pool/providers/vercel',
            credential_source: {
                file: '/tmp/vercel-oidc-token.txt',
            },
        };

        const clientInstance = { models: {} };

        GoogleGenAI.mockImplementation(function GoogleGenAIMock() {
            return clientInstance as never;
        });

        vi.stubEnv('VERCEL_OIDC_TOKEN', 'vercel-oidc-token');
        vi.stubEnv('GOOGLE_CREDENTIALS_JSON', JSON.stringify(credentials));
        vi.stubEnv('VERTEX_AI_PROJECT', 'genieph-prod');
        vi.stubEnv('VERTEX_AI_LOCATION', 'global');

        const { getAI } = await import('./client');

        expect(getAI()).toBe(clientInstance);
        expect(writeFileSync).toHaveBeenCalledWith('/tmp/vercel-oidc-token.txt', 'vercel-oidc-token');
        expect(GoogleGenAI).toHaveBeenCalledWith({
            vertexai: true,
            project: 'genieph-prod',
            location: 'global',
            googleAuthOptions: {
                credentials,
            },
        });
    });

    it('defaults preview traffic to the global Vertex location', async () => {
        GoogleGenAI.mockImplementation(function GoogleGenAIMock() {
            return { models: {} } as never;
        });

        vi.stubEnv(
            'GOOGLE_CREDENTIALS_JSON',
            JSON.stringify({
                type: 'external_account',
                credential_source: {
                    file: '/tmp/vercel-oidc-token.txt',
                },
            })
        );
        vi.stubEnv('VERTEX_AI_PROJECT', 'genieph-prod');

        const { getAI } = await import('./client');

        getAI();

        expect(GoogleGenAI).toHaveBeenCalledWith(
            expect.objectContaining({
                location: 'global',
            })
        );
    });

    it('falls back to GOOGLE_AI_API_KEY for local development when Vertex credentials are absent', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const clientInstance = { models: {} };

        GoogleGenAI.mockImplementation(function GoogleGenAIMock() {
            return clientInstance as never;
        });

        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('GOOGLE_AI_API_KEY', 'local-api-key');

        const { getAI } = await import('./client');

        expect(getAI()).toBe(clientInstance);
        expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'local-api-key' });
        expect(writeFileSync).not.toHaveBeenCalled();
        expect(consoleWarn).toHaveBeenCalledWith(
            'Using GOOGLE_AI_API_KEY fallback for local development. Production should use Vertex AI with Workload Identity Federation.'
        );

        consoleWarn.mockRestore();
    });

    it('falls back to GOOGLE_AI_API_KEY when WIF credentials exist but no OIDC token source is available', async () => {
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const clientInstance = { models: {} };

        GoogleGenAI.mockImplementation(function GoogleGenAIMock() {
            return clientInstance as never;
        });

        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('GOOGLE_AI_API_KEY', 'local-api-key');
        vi.stubEnv(
            'GOOGLE_CREDENTIALS_JSON',
            JSON.stringify({
                type: 'external_account',
                credential_source: {
                    file: '/tmp/vercel-oidc-token.txt',
                },
            })
        );

        const { getAI } = await import('./client');

        expect(getAI()).toBe(clientInstance);
        expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'local-api-key' });
        expect(consoleWarn).toHaveBeenCalledWith(
            'Falling back to GOOGLE_AI_API_KEY because the WIF subject token file is unavailable at /tmp/vercel-oidc-token.txt.'
        );

        consoleWarn.mockRestore();
    });

    it('refreshes the Vercel OIDC token file even when reusing the cached client', async () => {
        const clientInstance = { models: {} };

        GoogleGenAI.mockImplementation(function GoogleGenAIMock() {
            return clientInstance as never;
        });

        vi.stubEnv(
            'GOOGLE_CREDENTIALS_JSON',
            JSON.stringify({
                type: 'external_account',
                credential_source: {
                    file: '/tmp/vercel-oidc-token.txt',
                },
            })
        );
        vi.stubEnv('VERTEX_AI_PROJECT', 'genieph-prod');
        vi.stubEnv('VERCEL_OIDC_TOKEN', 'first-token');

        const { getAI } = await import('./client');

        expect(getAI()).toBe(clientInstance);

        vi.stubEnv('VERCEL_OIDC_TOKEN', 'second-token');

        expect(getAI()).toBe(clientInstance);
        expect(GoogleGenAI).toHaveBeenCalledTimes(1);
        expect(writeFileSync).toHaveBeenNthCalledWith(1, '/tmp/vercel-oidc-token.txt', 'first-token');
        expect(writeFileSync).toHaveBeenNthCalledWith(2, '/tmp/vercel-oidc-token.txt', 'second-token');
    });

    it('logs invalid credential JSON and still initializes the client', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const clientInstance = { models: {} };

        GoogleGenAI.mockImplementation(function GoogleGenAIMock() {
            return clientInstance as never;
        });
        vi.stubEnv('GOOGLE_CREDENTIALS_JSON', '{invalid-json');

        const { getAI } = await import('./client');

        expect(getAI()).toBe(clientInstance);
        expect(consoleError).toHaveBeenCalledWith(
            'Failed to parse GOOGLE_CREDENTIALS_JSON:',
            expect.any(SyntaxError)
        );

        const initOptions = GoogleGenAI.mock.calls[0]?.[0];
        expect(initOptions?.googleAuthOptions).toBeUndefined();

        consoleError.mockRestore();
    });
});
