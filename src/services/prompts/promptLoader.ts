import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK_PROMPT_PATH = 'src/services/prompts/fallback-prompt.txt';

type PromptQueryResult = {
  data: { prompt_text?: string | null; version?: string | number | null } | null;
  error: unknown;
};

type PromptQuery = {
  eq(column: string, value: boolean | string | number): {
    limit(count: number): {
      single(): PromiseLike<PromptQueryResult>;
    };
  };
  order(column: string, opts?: { ascending: boolean }): {
    limit(count: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
  };
};

type SupabasePromptClient = {
  from(table: string): {
    select(columns: string): PromptQuery;
  };
};

export function loadFallbackAnalysisPrompt() {
  return readFileSync(join(process.cwd(), FALLBACK_PROMPT_PATH), 'utf8');
}

export async function getAnalysisPromptWithFallback(supabase: SupabasePromptClient) {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_text')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!error && data?.prompt_text) {
    return data.prompt_text;
  }

  console.warn('Failed to fetch active AI prompt from Supabase; using fallback prompt file.');
  return loadFallbackAnalysisPrompt();
}

export async function getActivePromptDetails(supabase: SupabasePromptClient): Promise<{ promptText: string; version: string }> {
  try {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('prompt_text, version')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!error && data?.prompt_text) {
      return {
        promptText: data.prompt_text,
        version: String(data.version || 'unknown')
      };
    }
  } catch (err) {
    console.warn('Failed to fetch active prompt details from Supabase:', err);
  }

  return {
    promptText: loadFallbackAnalysisPrompt(),
    version: 'fallback'
  };
}

export async function getPromptDetailsByVersion(
  supabase: SupabasePromptClient,
  version: string,
): Promise<{ promptText: string; version: string } | null> {
  try {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('prompt_text, version')
      .eq('version', version)
      .limit(1)
      .single();

    if (!error && data?.prompt_text) {
      return {
        promptText: data.prompt_text,
        version: String(data.version || version),
      };
    }
  } catch (err) {
    console.warn(`Failed to fetch AI prompt version ${version}:`, err);
  }

  return null;
}

type PromptVersionRow = {
  id: string | number;
  version: string | number | null;
  is_active: boolean | null;
  created_at: string | null;
};

export async function getAllPromptVersions(
  supabase: SupabasePromptClient,
): Promise<PromptVersionRow[]> {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('id, version, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('Failed to fetch prompt versions:', error);
    return [];
  }

  return (data ?? []) as PromptVersionRow[];
}
