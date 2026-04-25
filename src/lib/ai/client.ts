import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

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

export const getAI = () => {
    // Refresh the short-lived OIDC token on every call so warm serverless instances
    // do not keep using an expired token file after the first initialization.
    writeVercelOidcToken();

    if (!ai) {
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
            isDevelopment && Boolean(apiKey) && needsOidcTokenFile && !hasOidcTokenSource;
        const useApiKeyFallback =
            Boolean(apiKey) &&
            isDevelopment &&
            !hasLegacyServiceAccount &&
            (!parsedCredentials || shouldFallbackFromIncompleteWif);

        const options: any = useApiKeyFallback
            ? { apiKey }
            : {
                vertexai: true,
                project: project,
                location: location
            };

        if (useApiKeyFallback) {
            if (shouldFallbackFromIncompleteWif && oidcTokenPath) {
                console.warn(
                    `Falling back to GOOGLE_AI_API_KEY for local development because the WIF subject token file is unavailable at ${oidcTokenPath}.`
                );
            } else {
                console.warn('Using GOOGLE_AI_API_KEY fallback for local development. Production should use Vertex AI with Workload Identity Federation.');
            }
        } else if (parsedCredentials) {
            // Check for JSON credentials in environment variable (Best for Vercel)
            options.googleAuthOptions = {
                credentials: parsedCredentials
            };
        } else {
            // Fallback for manual Service Account credentials if provided (Legacy)
            if (clientEmail && privateKey) {
                options.googleAuthOptions = {
                    credentials: {
                        client_email: clientEmail,
                        private_key: privateKey
                    }
                };
            }
        }

        try {
            ai = new GoogleGenAI(options);
        } catch (initError) {
            console.error('Failed to initialize Google AI (Vertex AI):', initError);
            throw new Error('Failed to initialize AI service. Please try again later.');
        }
    }
    return ai;
}
