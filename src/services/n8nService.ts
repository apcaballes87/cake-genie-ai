export interface N8nTriggerPayload {
  event: string;
  data?: Record<string, unknown>;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface N8nTriggerResult {
  success: boolean;
  skipped?: boolean;
  status?: number;
  responseText?: string;
  error?: string;
}

const DEFAULT_SOURCE = 'genieph-nextjs';
const N8N_TIMEOUT_MS = 15000;

function getN8nWebhookUrl(event: string) {
  const eventWebhookUrl = event === 'customer_chat.message_created'
    ? process.env.N8N_CUSTOMER_CHAT_WEBHOOK_URL?.trim()
    : '';
  const webhookUrl = eventWebhookUrl || process.env.N8N_WEBHOOK_URL?.trim();
  return webhookUrl || '';
}

function getN8nWebhookSecret(event: string) {
  const eventSecret = event === 'customer_chat.message_created'
    ? process.env.N8N_CUSTOMER_CHAT_WEBHOOK_SECRET?.trim()
    : '';

  return eventSecret || process.env.N8N_WEBHOOK_SECRET?.trim() || '';
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

/**
 * Sends an event to an n8n webhook.
 *
 * Keep this helper server-side. Call it from API routes, server actions,
 * cron jobs, or edge functions that can safely read environment variables.
 */
export async function triggerN8nWorkflow(
  payload: N8nTriggerPayload
): Promise<N8nTriggerResult> {
  const webhookUrl = getN8nWebhookUrl(payload.event);

  if (!webhookUrl) {
    console.warn(`[n8n] No webhook URL is configured for ${payload.event}. Skipping trigger.`);
    return {
      success: true,
      skipped: true,
      error: `No n8n webhook URL is configured for ${payload.event}`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
  const secret = getN8nWebhookSecret(payload.event);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-n8n-secret': secret } : {}),
      },
      body: JSON.stringify({
        event: payload.event,
        source: payload.source || DEFAULT_SOURCE,
        data: payload.data || {},
        metadata: payload.metadata || {},
        sentAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    const responseText = await readResponseText(response);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        responseText,
        error: `n8n webhook responded with ${response.status}`,
      };
    }

    return {
      success: true,
      status: response.status,
      responseText,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown n8n error';

    return {
      success: false,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
