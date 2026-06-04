import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK_PROMPT_PATH = 'src/services/prompts/fallback-prompt.txt';

type PromptQueryResult = {
  data: { prompt_text?: string | null } | null;
  error: unknown;
};

type SupabasePromptClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: boolean): {
        limit(count: number): {
          single(): PromiseLike<PromptQueryResult>;
        };
      };
    };
  };
};

export function loadFallbackAnalysisPrompt() {
  return readFileSync(join(process.cwd(), FALLBACK_PROMPT_PATH), 'utf8');
}

export async function getAnalysisPromptWithFallback(supabase: any) {
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
