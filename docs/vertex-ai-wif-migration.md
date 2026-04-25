# Technical Report: Migrating to Vertex AI with Workload Identity Federation

## Executive Summary

This project migrated its deployed AI routes from static Google credentials to **Vertex AI with Workload Identity Federation (WIF)**. The change was driven by an organization policy that disabled service account key creation and by deployment/runtime issues encountered when preview Gemini models were moved into production on Vercel.

The shared server-side client now lives in `src/lib/ai/client.ts` and uses:

- `GOOGLE_CREDENTIALS_JSON` for the external account configuration
- `VERCEL_OIDC_TOKEN` as the short-lived subject token
- `VERTEX_AI_PROJECT` for project selection
- `VERTEX_AI_LOCATION`, defaulting to `global`, for preview model access

## Scope

This report covers the **shared server-side Vertex AI path used by deployed API routes**. It does not claim that every utility script in the repository has already been migrated; several one-off scripts still use direct Gemini API keys and should be treated as separate follow-up work if they are brought into production.

## 1. The Core Problem

### Organization Policy Blocked Static Keys

The Google Cloud project enforced `iam.disableServiceAccountKeyCreation`, which prevented the team from creating traditional JSON service account keys. That blocked the normal "download a key and point the SDK at it" authentication path.

### Deployment Sync Produced `ENOENT`

Vercel serverless functions do not automatically bundle loose config files such as `credentials.json` unless those files are explicitly part of the build graph. That created production-only file lookup failures when the runtime expected a local credential file that was not present in the deployment artifact.

### Preview Models Returned Regional `404` Errors

Preview Gemini models such as `gemini-3-flash-preview` were not consistently available on regional endpoints like `us-central1`. Requests that succeeded against the global Vertex endpoint could fail with `404` when routed regionally.

## 2. The Solution Implemented

### Keyless Authentication via WIF

The project now uses Workload Identity Federation so Vercel can present a short-lived OpenID Connect token and Google Cloud can exchange that token for Vertex AI access without a static service account key.

At the infrastructure level, the setup includes:

- A Google Cloud Workload Identity Pool
- An OIDC provider that trusts `oidc.vercel.com`
- A service account bound to the Vercel identity
- `roles/aiplatform.user` granted to that service account

### Credentials Moved into an Environment Variable

To avoid Vercel bundling issues, the WIF client configuration was moved into `GOOGLE_CREDENTIALS_JSON` instead of relying on a checked-in or side-loaded JSON file. This keeps the configuration deployable without requiring a loose runtime file in the serverless bundle.

### Dynamic OIDC Token Handling at Runtime

`src/lib/ai/client.ts` writes `VERCEL_OIDC_TOKEN` to `/tmp/vercel-oidc-token.txt` during initialization. That lets the Google auth flow read the short-lived subject token from the path expected by the external account credential configuration.

### Global Endpoint Routing for Preview Models

The shared Vertex AI client defaults `VERTEX_AI_LOCATION` to `global`. This avoids the regional availability gap that affected preview Gemini models and makes the current API routes align with the global Vertex endpoint.

## 3. Runtime Implementation Notes

### Shared Client Behavior

The shared `getAI()` helper in `src/lib/ai/client.ts` now:

1. Writes `VERCEL_OIDC_TOKEN` to `/tmp/vercel-oidc-token.txt` when present.
2. Reads `GOOGLE_CREDENTIALS_JSON` and passes it into the Google auth options.
3. Initializes `@google/genai` in Vertex mode with the configured project and location.
4. Defaults the Vertex location to `global` when no explicit location is supplied.

### Route Impact

Current API routes use the shared `getAI()` client, which means the deployed server-side path now benefits from:

- Keyless auth on Vercel
- A single shared Vertex configuration point
- Consistent access to preview Gemini models through the global endpoint

## 4. Recommendations

### Keep WIF as the Production Default

Continue using Workload Identity Federation for deployed server-side routes. It satisfies the organization policy, avoids secret sprawl, and removes the operational burden of rotating static key files.

### Prefer `global` for Preview Models

For preview or experimental Gemini models, default the Vertex location to `global` unless regional availability has been explicitly confirmed.

### Treat Env Vars as the Deployment Contract

The minimum runtime contract for the shared Vertex client is:

- `GOOGLE_CREDENTIALS_JSON`
- `VERCEL_OIDC_TOKEN`
- `VERTEX_AI_PROJECT`
- `VERTEX_AI_LOCATION` (optional if `global` is desired)

### Migrate Legacy Scripts Separately

Some repository scripts still use direct Gemini API keys. Those scripts are outside the production route migration and should be migrated deliberately if they need the same security posture or execution environment.

## 5. Current Status

The deployed API route path has been updated to use Vertex AI through the shared keyless WIF flow, and the shared client defaults preview model traffic to the global endpoint.

In practical terms:

- Production server routes no longer depend on creating service account keys
- The Vercel deployment no longer depends on bundling a loose credentials file
- Preview Gemini model requests avoid the known regional endpoint availability issue
