import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export type CakeAnalysisProvider = 'gemini' | 'claude';

export type CakeAnalysisProviderSettings = {
    provider: CakeAnalysisProvider;
    geminiModel: string;
    claudeModel: string;
    fallbackEnabled: boolean;
};

const SETTINGS_ROW_ID = 'cake_analysis';
const SETTINGS_CACHE_TTL_MS = 30_000;

let cachedSettings: { value: CakeAnalysisProviderSettings; expiresAt: number } | null = null;

/** Env values are only the fallback when the Supabase row cannot be read. */
function getEnvDefaults(): CakeAnalysisProviderSettings {
    return {
        provider: process.env.AI_PROVIDER?.trim() === 'claude' ? 'claude' : 'gemini',
        geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
        claudeModel: process.env.CLAUDE_MODEL?.trim() || 'claude-haiku-5-5',
        fallbackEnabled: process.env.AI_FALLBACK_ENABLED?.trim() !== 'false',
    };
}

/**
 * Reads the admin-controlled provider switch from `ai_provider_settings`.
 * Cached briefly so a dashboard toggle takes effect within ~30 seconds
 * without adding a database round trip to every analysis.
 */
export async function getCakeAnalysisProviderSettings(): Promise<CakeAnalysisProviderSettings> {
    const now = Date.now();
    if (cachedSettings && cachedSettings.expiresAt > now) return cachedSettings.value;

    const defaults = getEnvDefaults();
    let value = defaults;
    try {
        const { data, error } = await createAdminServerSupabaseClient()
            .from('ai_provider_settings')
            .select('provider, gemini_model, claude_model, fallback_enabled')
            .eq('id', SETTINGS_ROW_ID)
            .maybeSingle();
        if (error) throw error;
        if (data) {
            value = {
                provider: data.provider === 'claude' ? 'claude' : 'gemini',
                geminiModel: data.gemini_model || defaults.geminiModel,
                claudeModel: data.claude_model || defaults.claudeModel,
                fallbackEnabled: data.fallback_enabled !== false,
            };
        }
    } catch (error) {
        console.warn('[AI Provider] Could not read ai_provider_settings; using env defaults.', error);
    }

    cachedSettings = { value, expiresAt: now + SETTINGS_CACHE_TTL_MS };
    return value;
}
