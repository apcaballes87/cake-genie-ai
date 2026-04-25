import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

let ai: InstanceType<typeof GoogleGenAI> | null = null;
type AIClientMode = 'vertex' | 'apiKey-fallback' | 'service-account-key';

type AIClientConfigState = {
    project: string;
    location: string;
    apiKey?: string;
    parsedCredentials: Record<string, any> | null;
    hasLegacyServiceAccount: boolean;
    oidcTokenPath: string | null;
    hasOidcTokenSource: boolean;
    shouldFallbackFromIncompleteWif: boolean;
    useApiKeyFallback: boolean;
    mode: AIClientMode;
};

let aiClientMode: AIClientMode | null = null;

function logAIClientInitialization(details: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    console.info('[AI Client] Initialized', details);
}

function writeVercelOidcToken() {
    if (!process.env.VERCEL_OIDC_TOKEN || typeof fs.writeFileSync !== 'function') {
        return;
    }

    try {
        fs.writeFileSync('/tmp/vercel-oidc-token.txt', process.env.VERCEL_OIDC_TOKEN);
    } catch (e) {
        console.error('Failed to write Vercel OIDC token:', e);
    }
}

function getAIClientConfigState(): AIClientConfigState {
    const project = process.env.VERTEX_AI_PROJECT || 'project-d823a677-2d5f-4826-aaf';
    const location = process.env.VERTEX_AI_LOCATION || 'global';
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const hasLegacyServiceAccount = Boolean(clientEmail && privateKey);
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let parsedCredentials: Record<string, any> | null = null;

    if (credentialsJson) {
        try {
            parsedCredentials = JSON.parse(credentialsJson);
        } catch (parseError) {
            console.error('Failed to parse GOOGLE_CREDENTIALS_JSON:', parseError);
        }
    }

    const oidcTokenPath =
        typeof parsedCredentials?.credential_source?.file === 'string'
            ? parsedCredentials.credential_source.file
            : null;
    const needsOidcTokenFile =
        parsedCredentials?.type === 'external_account' && Boolean(oidcTokenPath);
    const hasOidcTokenSource =
        Boolean(process.env.VERCEL_OIDC_TOKEN) ||
        Boolean(oidcTokenPath && typeof fs.existsSync === 'function' && fs.existsSync(oidcTokenPath));
    const shouldFallbackFromIncompleteWif =
        Boolean(apiKey) && needsOidcTokenFile && !hasOidcTokenSource;
    const useApiKeyFallback =
        Boolean(apiKey) &&
        !hasLegacyServiceAccount &&
        ((isDevelopment && !parsedCredentials) || shouldFallbackFromIncompleteWif);

    const mode: AIClientMode = useApiKeyFallback
        ? 'apiKey-fallback'
        : hasLegacyServiceAccount
            ? 'service-account-key'
            : 'vertex';

    return {
        project,
        location,
        apiKey,
        parsedCredentials,
        hasLegacyServiceAccount,
        oidcTokenPath,
        hasOidcTokenSource,
        shouldFallbackFromIncompleteWif,
        useApiKeyFallback,
        mode,
    };
}

export const getAI = () => {
    // Refresh the short-lived OIDC token on every call so warm serverless instances
    // do not keep using an expired token file after the first initialization.
    writeVercelOidcToken();

    if (!ai) {
        const state = getAIClientConfigState();
        aiClientMode = state.mode;

        const options: any = state.useApiKeyFallback
            ? { apiKey: state.apiKey }
            : {
                vertexai: true,
                project: state.project,
                location: state.location
            };

        if (state.useApiKeyFallback) {
            if (state.shouldFallbackFromIncompleteWif && state.oidcTokenPath) {
                console.warn(
                    `Falling back to GOOGLE_AI_API_KEY because the WIF subject token file is unavailable at ${state.oidcTokenPath}.`
                );
            } else {
                console.warn('Using GOOGLE_AI_API_KEY fallback for local development. Production should use Vertex AI with Workload Identity Federation.');
            }
        } else if (state.parsedCredentials) {
            // Check for JSON credentials in environment variable (Best for Vercel)
            options.googleAuthOptions = {
                credentials: state.parsedCredentials
            };
        } else {
            // Fallback for manual Service Account credentials if provided (Legacy)
            const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
            const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

            if (clientEmail && privateKey) {
                options.googleAuthOptions = {
                    credentials: {
                        client_email: clientEmail,
                        private_key: privateKey
                    }
                };
            }
        }

        logAIClientInitialization({
            mode: aiClientMode,
            project: aiClientMode === 'vertex' ? state.project : undefined,
            location: aiClientMode === 'vertex' ? state.location : undefined,
            hasWifCredentials: Boolean(state.parsedCredentials),
            hasLegacyServiceAccount: state.hasLegacyServiceAccount,
            usedApiKeyFallback: state.useApiKeyFallback,
            wifTokenPath: state.oidcTokenPath,
            hasOidcTokenSource: state.hasOidcTokenSource,
        });

        try {
            ai = new GoogleGenAI(options);
        } catch (initError) {
            console.error('Failed to initialize Google AI (Vertex AI):', initError);
            throw new Error('Failed to initialize AI service. Please try again later.');
        }
    }
    return ai;
}

export function getAIClientMode() {
    return aiClientMode;
}

export function getAIClientDiagnostics() {
    const state = getAIClientConfigState();

    return {
        initialized: Boolean(ai),
        mode: aiClientMode ?? state.mode,
        project: state.project,
        location: state.location,
        hasApiKey: Boolean(state.apiKey),
        hasWifCredentials: Boolean(state.parsedCredentials),
        hasLegacyServiceAccount: state.hasLegacyServiceAccount,
        hasVercelOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
        wifTokenPath: state.oidcTokenPath,
        hasOidcTokenSource: state.hasOidcTokenSource,
        willUseApiKeyFallback: state.useApiKeyFallback,
        shouldFallbackFromIncompleteWif: state.shouldFallbackFromIncompleteWif,
        nodeEnv: process.env.NODE_ENV || null,
    };
}
