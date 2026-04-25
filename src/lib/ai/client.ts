import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

export const getAI = () => {
    if (!ai) {
        // Handle Vercel OIDC Token for Workload Identity Federation
        if (process.env.VERCEL_OIDC_TOKEN && typeof fs.writeFileSync === 'function') {
            try {
                fs.writeFileSync('/tmp/vercel-oidc-token.txt', process.env.VERCEL_OIDC_TOKEN);
            } catch (e) {
                console.error('Failed to write Vercel OIDC token:', e);
            }
        }

        const project = process.env.VERTEX_AI_PROJECT || 'project-d823a677-2d5f-4826-aaf';
        const location = process.env.VERTEX_AI_LOCATION || 'us-central1';

        const options: any = {
            vertexai: true,
            project: project,
            location: location
        };

        // Fallback for manual Service Account credentials if provided
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

        try {
            ai = new GoogleGenAI(options);
        } catch (initError) {
            console.error('Failed to initialize Google AI (Vertex AI):', initError);
            throw new Error('Failed to initialize AI service. Please try again later.');
        }
    }
    return ai;
}

