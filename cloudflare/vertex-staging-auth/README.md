# Staging Vertex authentication

This isolated Worker returns a verified Cloudflare Access service-token JWT for
Google Workload Identity Federation. It contains no Google service-account key.
The Cloudflare service-token client secret is still a long-lived credential and
belongs only in the staging application's server-side credential configuration.

## Prerequisites

- Activate Cloudflare Zero Trust with the user's chosen plan.
- Create a dedicated staging Access service token and a hostname-based Access
  application for `genieph-vertex-staging-auth.apcaballes.workers.dev`.
- Add a Service Auth policy accepting only that service token. Do not protect
  Genie production or modify its domain routes.
- Set this Worker's three non-secret variables to the exact Access team origin,
  application AUD tag, and service-token Client ID. The checked-in empty values
  intentionally fail closed. Regenerate binding types after setting them.
- Deploy the broker; request `/token` with `CF-Access-Client-Id` and
  `CF-Access-Client-Secret` through Access. Never log or display the returned JWT.

The broker validates RS256 signature, issuer, audience, service identity, and
expiry. It uses the team's fixed `/cdn-cgi/access/certs` endpoint rather than a
URL supplied by the request. Service-token JWTs have an empty `sub`, so the
Google principal must use `common_name` instead. Do not rely on an Access cookie:
strict service-token authentication can omit `CF_Authorization`.

## Dedicated Google trust

The staging project is `project-4d0a4d0b-6717-4a7a-9c1`, number `67341248721`.
The dedicated service account and pool are already created; verify their current
state before applying the following commands. Substitute exact non-secret Access
values for `TEAM_ORIGIN`, `ACCESS_AUD`, and `SERVICE_TOKEN_CLIENT_ID`.

```sh
gcloud iam workload-identity-pools providers create-oidc cloudflare-access \
  --project=project-4d0a4d0b-6717-4a7a-9c1 --location=global \
  --workload-identity-pool=cloudflare-staging \
  --issuer-uri=TEAM_ORIGIN --allowed-audiences=ACCESS_AUD \
  --attribute-mapping=google.subject=assertion.common_name \
  --attribute-condition="assertion.type == 'app' && assertion.sub == '' && assertion.common_name == 'SERVICE_TOKEN_CLIENT_ID' && 'ACCESS_AUD' in assertion.aud"

gcloud projects add-iam-policy-binding project-4d0a4d0b-6717-4a7a-9c1 \
  --member=serviceAccount:cloudflare-staging-vertex@project-4d0a4d0b-6717-4a7a-9c1.iam.gserviceaccount.com \
  --role=roles/aiplatform.user

gcloud iam service-accounts add-iam-policy-binding \
  cloudflare-staging-vertex@project-4d0a4d0b-6717-4a7a-9c1.iam.gserviceaccount.com \
  --project=project-4d0a4d0b-6717-4a7a-9c1 \
  --role=roles/iam.workloadIdentityUser \
  --member=principal://iam.googleapis.com/projects/67341248721/locations/global/workloadIdentityPools/cloudflare-staging/subject/SERVICE_TOKEN_CLIENT_ID
```

Verify that the Access team exposes the OIDC discovery metadata required by Google before creating the provider. If it does not, use Google’s documented uploaded JWKS option with the exact keys from the team certs endpoint and arrange key rotation; do not assume direct issuer discovery works.

Do not grant a wildcard pool principal or change the Vercel provider. If only
prediction is required, review a narrower custom permission set separately;
`roles/aiplatform.user` is the existing application's baseline Vertex role.

## Server-side external-account configuration

Prepare this JSON privately, outside Git. Replace the two service-token fields
with the actual credentials. The client secret must never enter public build
variables, source, browser code, logs, or this README.

```json
{
  "type": "external_account",
  "audience": "//iam.googleapis.com/projects/67341248721/locations/global/workloadIdentityPools/cloudflare-staging/providers/cloudflare-access",
  "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
  "token_url": "https://sts.googleapis.com/v1/token",
  "service_account_impersonation_url": "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/cloudflare-staging-vertex@project-4d0a4d0b-6717-4a7a-9c1.iam.gserviceaccount.com:generateAccessToken",
  "credential_source": {
    "url": "https://genieph-vertex-staging-auth.apcaballes.workers.dev/token",
    "headers": {
      "CF-Access-Client-Id": "SERVICE_TOKEN_CLIENT_ID",
      "CF-Access-Client-Secret": "PRIVATE_SERVICE_TOKEN_CLIENT_SECRET"
    },
    "format": { "type": "text" }
  }
}
```

The existing `getAI()` passes parsed `GOOGLE_CREDENTIALS_JSON` directly into
`googleAuthOptions.credentials`, including URL credential sources and headers.
It needs no Vercel OIDC file for this configuration. Google Auth retrieves the
broker token again when refreshing access credentials. Set only staging
`GOOGLE_CREDENTIALS_JSON`, `VERTEX_AI_PROJECT`, and `VERTEX_AI_LOCATION=global`.
Do not enable the Gemini Developer API fallback.

## Verification

```sh
cd cloudflare/vertex-staging-auth
npm ci
npm test
npm run typecheck
npm run deploy:check
```

Before claiming the integration works, verify the broker denies missing,
incorrect, and expired identities, privately exchange a fresh signed token with
Google STS, impersonate the staging service account, and make one real staging
Vertex image-validation request. Passing these local tests proves the broker's
checks; it does not prove Cloudflare-to-Google trust or fresh model inference.

Sources: [Access service JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/),
[strict service authentication](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/),
[Workers Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/),
[Google WIF with other providers](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers).
