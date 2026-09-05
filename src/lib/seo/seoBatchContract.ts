export type SeoBatchItem = {
  id: string;
  cache_id: string;
  analysis_revision: string;
  analysis_json: Record<string, unknown>;
  attempt_count: number;
  status: string;
};

export type SeoBatchOutput = {
  customId?: string;
  custom_id?: string;
  id?: string;
  request?: { contents?: Array<{ parts?: Array<{ text?: string }> }> };
  response?: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: Record<string, unknown>;
  };
  error?: { message?: string };
  status?: unknown;
};

export function buildSeoBatchInputLine(item: SeoBatchItem, prompt: string) {
  // Echo this identifier in the request too: Vertex output does not always retain customId.
  const input = { seo_job_id: item.id, analysis_revision: item.analysis_revision, analysis: item.analysis_json };
  return JSON.stringify({
    customId: item.id,
    request: {
      systemInstruction: { parts: [{ text: prompt }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { seo_description: { type: 'STRING' }, alt_text: { type: 'STRING' } },
          required: ['seo_description', 'alt_text'],
        },
      },
    },
  });
}

export function getSeoOutputItemId(output: SeoBatchOutput): string | undefined {
  const direct = output.customId || output.custom_id || output.id;
  if (direct) return direct;
  for (const content of output.request?.contents ?? []) {
    for (const part of content.parts ?? []) {
      try {
        const input = JSON.parse(part.text ?? '');
        if (typeof input.seo_job_id === 'string') return input.seo_job_id;
      } catch { /* Only structured echoed input is a trusted correlation key. */ }
    }
  }
  return undefined;
}

export function parseSeoBatchOutput(output: SeoBatchOutput) {
  if (output.error) throw new Error(output.error.message || 'Provider returned an item error.');
  const text = output.response?.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim();
  if (!text) throw new Error('Provider returned no SEO content.');
  const value = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  if (!value || typeof value !== 'object') throw new Error('Invalid SEO object.');
  for (const key of ['seo_description', 'alt_text']) {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 4000) {
      throw new Error(`Invalid ${key}.`);
    }
  }
  return { seo_description: value.seo_description.trim() as string, alt_text: value.alt_text.trim() as string };
}

export function seoRetryStatus(attempts: number) {
  return attempts >= 3 ? 'failed' : 'retryable';
}
