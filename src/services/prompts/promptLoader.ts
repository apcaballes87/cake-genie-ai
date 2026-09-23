import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const FALLBACK_PROMPT_PATH = 'src/services/prompts/fallback-prompt.txt';
/** Keep offline generation on the same contract as the staged v3.95 bbox fallback. */
export const FALLBACK_ANALYSIS_PROMPT_VERSION = '3.95';

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

function resolvePromptVersion(promptText: string, fallbackVersion = FALLBACK_ANALYSIS_PROMPT_VERSION) {
  return promptText.match(/\*\*v(\d+\.\d+) Version\b/i)?.[1] ?? fallbackVersion;
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
        version: String(data.version ?? resolvePromptVersion(data.prompt_text)),
      };
    }
  } catch (err) {
    console.warn('Failed to fetch active prompt details from Supabase:', err);
  }

  const promptText = loadFallbackAnalysisPrompt();
  return {
    promptText,
    // The fallback file retains its historical v3.91 body/header for parity
    // checks, but its appended scope override is the v3.93 contract.
    version: FALLBACK_ANALYSIS_PROMPT_VERSION,
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

export type LabPromptRecord = {
  id: string;
  version: string;
  isActive: boolean;
  text: string;
  checksum: string;
};

type LabPromptRow = {
  prompt_id: string | number;
  version: string | number | null;
  is_active: boolean | null;
  created_at: string | null;
  prompt_text: string | null;
};

/** SHA-256 makes the exact text executed by an admin lab run auditable without persistence. */
export function checksumAnalysisPrompt(promptText: string) {
  return createHash('sha256').update(promptText, 'utf8').digest('hex');
}

/**
 * The lab deliberately exposes a very small prompt set: production active plus
 * the most recently staged row. It is read-only and never changes activation.
 */
export async function getAiPromptLabPrompts(
  supabase: SupabasePromptClient,
): Promise<LabPromptRecord[]> {
  try {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('prompt_id, version, is_active, created_at, prompt_text')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    const rows = (data ?? []) as LabPromptRow[];
    const active = rows.find((row) => row.is_active && row.prompt_text);
    const staged = rows.find((row) => !row.is_active && row.prompt_text);
    const selected = [active, staged].filter((row): row is LabPromptRow => Boolean(row));
    if (selected.length) {
      return selected.map((row) => ({
        id: String(row.prompt_id),
        version: String(row.version ?? 'unknown'),
        isActive: Boolean(row.is_active),
        text: row.prompt_text!,
        checksum: checksumAnalysisPrompt(row.prompt_text!),
      }));
    }
  } catch (error) {
    console.warn('Failed to fetch AI Prompt Lab prompt records:', error);
  }

  const text = loadFallbackAnalysisPrompt();
  return [{
    id: 'fallback',
    version: FALLBACK_ANALYSIS_PROMPT_VERSION,
    isActive: true,
    text,
    checksum: checksumAnalysisPrompt(text),
  }];
}

export async function getAllPromptVersions(
  supabase: SupabasePromptClient,
): Promise<PromptVersionRow[]> {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_id, version, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('Failed to fetch prompt versions:', error);
    return [];
  }

  return ((data ?? []) as Array<Omit<PromptVersionRow, 'id'> & { prompt_id: string | number }>).map((row) => ({
    id: row.prompt_id,
    version: row.version,
    is_active: row.is_active,
    created_at: row.created_at,
  }));
}

export const SEO_PROMPT_VERSION = 'seo-v1.0';

export function getSeoPromptDetails(): { promptText: string; version: string } {
  return {
    promptText: readFileSync(join(process.cwd(), 'src/services/prompts/seo-prompt.txt'), 'utf8'),
    version: SEO_PROMPT_VERSION,
  };
}
