# n8n Integration

This app can send events to an n8n workflow through a webhook.

## Environment Variables

Set these in your local `.env.local` and in your deployment environment:

- `N8N_WEBHOOK_URL` - Full n8n webhook URL, for example `https://your-n8n-domain/webhook/<path>`
- `N8N_WEBHOOK_SECRET` - Optional shared secret sent as `x-n8n-secret`

Customer-chat Telegram notifications use dedicated variables so they do not
take over a future generic n8n workflow:

- `N8N_CUSTOMER_CHAT_WEBHOOK_URL` - Production URL from the imported customer-chat workflow
- `N8N_CUSTOMER_CHAT_WEBHOOK_SECRET` - Shared `x-n8n-secret` value for that workflow

If the dedicated variables are absent, customer-chat events fall back to the
generic `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` values.

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

## Customer chat to Telegram

Import [`customer-chat-telegram-n8n.json`](./customer-chat-telegram-n8n.json)
into n8n. It is preconfigured to reuse:

- Telegram chat ID `8338914088`
- Telegram credential `Telegram account` (`3XtMcYGvIV5NkxP7`)
- A text notification for every new customer-authored message
- A second Telegram photo message only when the customer attached an image

The workflow expects this event from the app:

```json
{
  "event": "customer_chat.message_created",
  "source": "genieph-nextjs",
  "data": {
    "messageId": "message UUID",
    "conversationId": "conversation UUID",
    "senderType": "customer",
    "content": "Customer message",
    "imageUrl": null,
    "customerName": "Customer name",
    "customerEmail": "customer@example.com",
    "pageUrl": "https://genie.ph/customizing/example",
    "pageTitle": "Example cake | Genie",
    "createdAt": "2026-08-02T00:00:00.000Z"
  }
}
```

### Activation checklist

1. In n8n, create a Header Auth credential named `Genie app webhook secret`.
   Set the header name to `x-n8n-secret` and generate the value with
   `openssl rand -hex 32`.
2. Open the imported `Customer chat webhook` node and select that Header Auth
   credential. Confirm the two Telegram nodes resolve to the existing
   `Telegram account` credential.
3. Activate the workflow and copy its **Production URL**. The test URL only
   listens while the editor is actively testing the node.
4. Add the production URL as `N8N_CUSTOMER_CHAT_WEBHOOK_URL` in Vercel and add
   the same shared secret as `N8N_CUSTOMER_CHAT_WEBHOOK_SECRET`.
5. Redeploy Genie.ph, send one text-only customer-chat message, then send one
   image message. Confirm one text alert for each and one additional photo for
   the image message.

The notification is scheduled only after Supabase successfully stores the
customer message. n8n or Telegram failures are logged without changing the
customer's successful chat response.
