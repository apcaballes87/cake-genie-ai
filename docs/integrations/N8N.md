# n8n Integration

This app can send events to an n8n workflow through a webhook.

## Environment Variables

Set these in your local `.env.local` and in your deployment environment:

- `N8N_WEBHOOK_URL` - Full n8n webhook URL, for example `https://your-n8n-domain/webhook/<path>`
- `N8N_WEBHOOK_SECRET` - Optional shared secret sent as `x-n8n-secret`

## How It Works

Use `triggerN8nWorkflow()` from [`src/services/n8nService.ts`](../../src/services/n8nService.ts) inside:

- API routes
- server actions
- cron jobs
- background tasks

The payload shape is:

```ts
{
  event: string;
  source?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

## Example

```ts
import { triggerN8nWorkflow } from '@/services/n8nService';

await triggerN8nWorkflow({
  event: 'newsletter.subscribed',
  data: {
    email,
    discountCode,
  },
});
```

## n8n Side

In n8n, add a `Webhook` node that accepts `POST` requests.

If you use `N8N_WEBHOOK_SECRET`, validate the `x-n8n-secret` header in the workflow before processing the event.

## Existing Workflow Export

The repo already includes n8n exports such as [`upload-to-shopify-cakesandmemories.n8n`](../../upload-to-shopify-cakesandmemories.n8n).

Import the workflow into your n8n instance, then copy the active webhook URL from the webhook node into `N8N_WEBHOOK_URL`.
