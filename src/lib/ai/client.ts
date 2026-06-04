import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

let ai: InstanceType<typeof GoogleGenAI> | null = null;
type AIClientMode = 'vertex' | 'apiKey-fallback' | 'service-account-key';
type AIRequestContext = {
    headers?: {
        get(name: string): string | null | undefined;
    };
} | null | undefined;

type AIClientConfigState = {
    project: string;
    location: string;
    apiKey?: string;
    parsedCredentials: Record<string, unknown> | null;
    hasLegacyServiceAccount: boolean;
    oidcTokenPath: string | null;
    runtimeOidcToken: string | null;
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

function getRuntimeOidcToken(requestContext?: AIRequestContext) {
    const rawToken = requestContext?.headers?.get('x-vercel-oidc-token') ?? process.env.VERCEL_OIDC_TOKEN ?? null;
    const token = rawToken?.trim();
    if (!token) return null;
    return token.startsWith('Bearer ') ? token.slice('Bearer '.length).trim() : token;
}

function writeVercelOidcToken(token: string | null, oidcTokenPath: string | null) {
    if (!token || typeof fs.writeFileSync !== 'function') {
        return;
    }

    try {
        fs.writeFileSync(oidcTokenPath || '/tmp/vercel-oidc-token.txt', token);
    } catch (e) {
        console.error('Failed to write Vercel OIDC token:', e);
    }
}

function getCredentialSourceFile(credentials: Record<string, unknown> | null) {
    const credentialSource = credentials?.credential_source;
    if (!credentialSource || typeof credentialSource !== 'object') {
        return null;
    }
    const file = (credentialSource as { file?: unknown }).file;
    return typeof file === 'string' ? file : null;
}

function getAIClientConfigState(requestContext?: AIRequestContext): AIClientConfigState {
    const project = process.env.VERTEX_AI_PROJECT || 'project-d823a677-2d5f-4826-aaf';
    const location = process.env.VERTEX_AI_LOCATION || 'global';
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const hasLegacyServiceAccount = Boolean(clientEmail && privateKey);
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const runtimeOidcToken = getRuntimeOidcToken(requestContext);
    let parsedCredentials: Record<string, unknown> | null = null;

    if (credentialsJson) {
        try {
            parsedCredentials = JSON.parse(credentialsJson);
        } catch (parseError) {
            console.error('Failed to parse GOOGLE_CREDENTIALS_JSON:', parseError);
        }
    }

    const oidcTokenPath = getCredentialSourceFile(parsedCredentials);
    const needsOidcTokenFile =
        parsedCredentials?.type === 'external_account' && Boolean(oidcTokenPath);
    const hasOidcTokenSource =
        Boolean(runtimeOidcToken) ||
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
        runtimeOidcToken,
        hasOidcTokenSource,
        shouldFallbackFromIncompleteWif,
        useApiKeyFallback,
        mode,
    };
}

export const getAI = (requestContext?: AIRequestContext) => {
    const state = getAIClientConfigState(requestContext);
    // Refresh the short-lived OIDC token on every call so warm serverless instances
    // do not keep using an expired token file after the first initialization.
    writeVercelOidcToken(state.runtimeOidcToken, state.oidcTokenPath);

    if (!ai) {
        aiClientMode = state.mode;

        const options: ConstructorParameters<typeof GoogleGenAI>[0] = state.useApiKeyFallback
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
            hasRuntimeOidcToken: Boolean(state.runtimeOidcToken),
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

export function getGoogleCloudAuthOptions(requestContext?: AIRequestContext) {
    const state = getAIClientConfigState(requestContext);
    writeVercelOidcToken(state.runtimeOidcToken, state.oidcTokenPath);

    const credentials = state.parsedCredentials ?? (
        state.hasLegacyServiceAccount
            ? {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }
            : undefined
    );

    return {
        projectId: state.project,
        ...(credentials ? { credentials } : {}),
    };
}

export function getAIClientMode() {
    return aiClientMode;
}

export function getAIClientDiagnostics(requestContext?: AIRequestContext) {
    const state = getAIClientConfigState(requestContext);

    return {
        initialized: Boolean(ai),
        mode: aiClientMode ?? state.mode,
        project: state.project,
        location: state.location,
        hasApiKey: Boolean(state.apiKey),
        hasWifCredentials: Boolean(state.parsedCredentials),
        hasLegacyServiceAccount: state.hasLegacyServiceAccount,
        hasVercelOidcToken: Boolean(state.runtimeOidcToken),
        wifTokenPath: state.oidcTokenPath,
        hasOidcTokenSource: state.hasOidcTokenSource,
        willUseApiKeyFallback: state.useApiKeyFallback,
        shouldFallbackFromIncompleteWif: state.shouldFallbackFromIncompleteWif,
        nodeEnv: process.env.NODE_ENV || null,
    };
}

/**
 * Retrieves an active context cache for the given prompt version or creates a new one.
 * Returns the resource name of the cache if successful, or null on failure.
 */
export async function getOrCreatePromptCache(
    aiClient: InstanceType<typeof GoogleGenAI>,
    promptText: string,
    version: string,
    systemInstruction: string
): Promise<string | null> {
    try {
        const cleanVersion = version.replace(/\./g, '-');
        const cacheDisplayName = `genie-cake-analysis-prompt-v${cleanVersion}`;
        
        console.info(`[AI Cache] Checking for active cache: ${cacheDisplayName}`);
        const listResult = await aiClient.caches.list();
        
        for await (const cache of listResult) {
            if (!cache.name) continue;
            if (cache.displayName === cacheDisplayName) {
                // Ensure the cache is not expired or about to expire (within 10 minutes)
                const expireTime = cache.expireTime ? new Date(cache.expireTime).getTime() : 0;
                const now = Date.now();
                if (expireTime > now + 600_000) {
                    console.info(`[AI Cache] Reusing active cache: ${cache.name}`);
                    return cache.name;
                } else {
                    console.warn(`[AI Cache] Cache ${cache.name} is expiring soon. Cleaning it up.`);
                    try {
                        await aiClient.caches.delete({ name: cache.name });
                    } catch (delErr) {
                        // Ignore deletion failures
                    }
                }
            }
        }
        
        console.info(`[AI Cache] Cache not found. Creating new cached content for version ${version}...`);
        const newCache = await aiClient.caches.create({
            model: 'gemini-3.1-flash-lite-preview',
            config: {
                contents: [
                    { role: 'user', parts: [{ text: promptText }] }
                ],
                systemInstruction: systemInstruction,
                ttl: '604800s', // 7 days TTL (automatically cleaned up if unused)
                displayName: cacheDisplayName,
            }
        });
        
        console.info(`[AI Cache] Successfully created cache: ${newCache.name}`);
        return newCache.name ?? null;
    } catch (error) {
        console.error('[AI Cache] Failed to manage context cache:', error);
        return null;
    }
}

