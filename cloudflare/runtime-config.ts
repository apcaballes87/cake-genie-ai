// Only application variables in this list cross from the Worker into Node.
// Cloudflare bindings and unrelated account secrets must never be forwarded.
export const APP_ENV_NAMES = new Set([
  'ADMIN_DASHBOARD_ORIGIN',
  'CAKES_AND_MEMORIES_PRICING_ENABLED',
  'CAKE_ANALYSIS_PROMPT_VERSION',
  'CRON_SECRET',
  'DATAFORSEO_LOGIN',
  'DATAFORSEO_PASSWORD',
  'DELAYED_STUDIO_BATCH_LIMIT',
  'ENABLE_DELAYED_STUDIO_EDITING',
  'EXA_API_KEY',
  'GOOGLE_AI_API_KEY',
  'GOOGLE_CREDENTIALS_JSON',
  'KV_REST_API_TOKEN',
  'KV_REST_API_URL',
  'N8N_CUSTOMER_CHAT_WEBHOOK_SECRET',
  'N8N_CUSTOMER_CHAT_WEBHOOK_URL',
  'N8N_WEBHOOK_SECRET',
  'N8N_WEBHOOK_URL',
  'NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'NEXT_PUBLIC_PINTEREST_APP_ID',
  'NEXT_PUBLIC_ROBOFLOW_API_KEY',
  'NEXT_PUBLIC_ROBOFLOW_CONFIDENCE',
  'NEXT_PUBLIC_ROBOFLOW_FALLBACK',
  'NEXT_PUBLIC_ROBOFLOW_WORKFLOW_ID',
  'NEXT_PUBLIC_ROBOFLOW_WORKSPACE',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_USE_NEW_PRICING',
  'PINTEREST_APP_SECRET',
  'PINTEREST_CLIENT_ID',
  'PINTEREST_CLIENT_SECRET',
  'PINTEREST_REDIRECT_URI',
  'REJECTED_UPLOAD_IP_HASH_SALT',
  'ROBOFLOW_API_KEY',
  'ROBOFLOW_WORKFLOW_ID',
  'ROBOFLOW_WORKSPACE',
  'SEO_BATCH_SUBMISSIONS_ENABLED',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_WEBHOOK_SECRET',
  'TYPESENSE_API_KEY',
  'TYPESENSE_SHADOW_SAMPLE_RATE',
  'TYPESENSE_URL',
  'VERTEX_AI_BATCH_GCS_URI',
  'VERTEX_AI_LOCATION',
  'VERTEX_AI_PROJECT',
]);

export function appEnvironment(bindings: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bindings).filter(
      ([name, value]) => APP_ENV_NAMES.has(name) && typeof value === 'string',
    ),
  );
}

export function requiredBinding(bindings: object, name: string): string {
  const value = Object.entries(bindings).find(([key]) => key === name)?.[1];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing Cloudflare binding: ${name}`);
  }
  return value;
}
