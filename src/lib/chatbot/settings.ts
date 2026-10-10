import type { SupabaseClient } from '@supabase/supabase-js';

const CACHE_TTL_MS = 15_000;

let cache: { loadedAt: number; enabled: boolean } | null = null;

/**
 * Whether the assistant may answer. The admin dashboard flips
 * `chatbot_settings.enabled`; setting CHATBOT_ENABLED=false in the environment
 * is a hard override that forces it off. Fails closed on any read problem.
 */
export async function isChatbotEnabled(
  supabase: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): Promise<boolean> {
  if (env.CHATBOT_ENABLED === 'false') {
    return false;
  }

  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.enabled;
  }

  try {
    const { data, error } = await supabase
      .from('chatbot_settings')
      .select('enabled')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.warn('[chat-assistant] Could not read chatbot_settings:', error.message);
      return false;
    }

    const enabled = (data as { enabled?: boolean } | null)?.enabled === true;
    cache = { loadedAt: now, enabled };
    return enabled;
  } catch (error) {
    console.warn('[chat-assistant] Could not read chatbot_settings:', error);
    return false;
  }
}

export function resetChatbotSettingsCache() {
  cache = null;
}
