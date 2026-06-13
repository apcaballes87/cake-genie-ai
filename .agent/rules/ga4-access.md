# GA4 Access — Genie.ph (properties/510070439)

> Project memory for the genieph-nextjs repo. Any Claude/agent session in this workspace
> can hit Genie.ph's GA4 by following the snippets below. Verified working on **2026-06-10**.

---

## TL;DR

```python
# OAuth ADC path is what currently works — see "Auth status" below.
# Do NOT set GOOGLE_APPLICATION_CREDENTIALS. Just import + use the client.
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric,
    FilterExpression, Filter,
)

client = BetaAnalyticsDataClient()  # picks up ADC automatically

req = RunReportRequest(
    property="properties/510070439",
    date_ranges=[DateRange(start_date="2026-01-01", end_date="today")],
    dimensions=[Dimension(name="yearMonth")],
    metrics=[Metric(name="totalUsers"), Metric(name="sessions")],
    dimension_filter=FilterExpression(
        filter=Filter(
            field_name="country",
            string_filter=Filter.StringFilter(
                value="Philippines",
                match_type=Filter.StringFilter.MatchType.EXACT,
            ),
        )
    ),
)
for row in client.run_report(req).rows:
    print(row.dimension_values[0].value, row.metric_values[0].value)
```

---

## Project Constants

| Field | Value |
|---|---|
| **GA4 Property** | `properties/510070439` |
| **Domain** | genie.ph |
| **Measurement ID (client-side)** | `G-C28QNPRWFK` (loaded in `src/app/layout.tsx`) |
| **Helper module** | `src/lib/analytics.ts` (client-side `gtag` wrapper) |

## Auth Status (verified 2026-06-13)

### ✅ Service account — USE THIS (works as of 2026-06-13)
- **Service account email:** `persimmon-cakes@project-068ffeda-8588-46f8-b98.iam.gserviceaccount.com`
- **Key file:** `/Users/apcaballes/ga4-service-account.json`
- **GA4 grant:** **Viewer** role on property `510070439` (added 2026-06-13 by Alan in
  GA4 Admin → Property Access Management)
- **Set the env var before running any GA4 query:**

  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS=/Users/apcaballes/ga4-service-account.json
  ```

  The `GOOGLE_APPLICATION_CREDENTIALS` line is also appended to `~/.zshrc` for persistence
  — new terminals in this user's environment pick it up automatically.

### ❌ OAuth ADC — present but **NO LONGER works** for GA4 Data API
- **Credentials file:** `~/.config/gcloud/application_default_credentials.json`
- **OAuth client ID:** `764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com`
  (this is the gcloud CLI's *public, unverified* client — when the user signs in with a
  regular @gmail.com account, Google now blocks the consent screen with "This app is
  blocked" on any sensitive scope)
- **Behavior:** `BetaAnalyticsDataClient()` picks up ADC automatically and fails with
  `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` because the recorded token scopes don't include
  `analytics.readonly` for the Data API.
- **Why we abandoned this path:** Workspace allowlist would unblock it, but it's a
  one-time admin task for a one-time data pull. Service-account path is faster and
  non-interactive.
- **Do not** rely on ADC for GA4 in this workspace. Always export the service-account
  key instead.

## Common Dimensions

| Dimension | Use for |
|---|---|
| `date` (YYYYMMDD) | daily trends |
| `yearMonth` (YYYYMM) | monthly rollups — preferred for YTD cards |
| `country` (ISO code) | "Philippines" filter for PH-only rollups |
| `city` | PH city breakdown |
| `sessionSource` / `sessionMedium` | traffic attribution |
| `pagePath` | top pages |
| `eventName` | funnel events |
| `deviceCategory` | desktop/mobile/tablet |
| `newVsReturning` | new vs returning |

## Common Metrics

`totalUsers`, `sessions`, `bounceRate`, `averageSessionDuration`, `conversions`,
`eventCount`, `screenPageViews`, `engagedSessions`, `engagementRate`.

## Funnel Events Tracked (client-side via `src/lib/analytics.ts`)

`page_view` → `view_item` → `select_item` → `add_to_cart` → `begin_checkout` → `purchase`

Funnel query: `dimensions=[eventName]`, `metrics=[totalUsers, eventCount]`, PH filter.

## Project Quirks

- **Data thresholding:** GA4 hides low-volume rows. For accurate PH totals, always add
  `dimension_filter country == "Philippines"` — otherwise country/city breakdowns may not
  sum to the unfiltered total.
- **Singapore bot traffic:** Started ~March 2026, ~1,400 users/month, 95% Direct/(none),
  ~98% bounce. Middleware now blocks it. Expect SG users near zero in 2026-04+.
- **Data freshness:** GA4 has 24–48h processing delay. For "today" queries, the latest
  ~2 days will be partial.
- **YTD range:** `2026-01-01` to `today`. Reset to `2027-01-01` on Jan 1, 2027.

## Quick Recipes

```python
# 1. Monthly PH users (YTD)
# dim: yearMonth, filter: country == "Philippines", metric: totalUsers

# 2. Top PH cities
# dim: city, filter: country == "Philippines", orderBy: totalUsers desc, limit: 20

# 3. PH traffic sources
# dim: sessionSource + sessionMedium, filter: country == "Philippines"

# 4. Conversion funnel (PH)
# dim: eventName, filter: country == "Philippines", metrics: totalUsers + eventCount

# 5. Top pages (PH, last 30d)
# dim: pagePath, filter: country == "Philippines", date: 30daysAgo..today, sort: totalUsers desc
```

## Generic Skill

A general-purpose Google SEO skill (Search Console, PSI, CrUX, GA4) lives at
`.agent/skills/seo-google/`. It's good for cross-API workflows but expects a config file at
`~/.config/claude-seo/google-api.json` which is **not** set up in this workspace — use the
direct Python snippets above for Genie.ph instead.

## Pre-flight Check (run before trusting a fresh setup)

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
python3 -c "
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Metric
r = BetaAnalyticsDataClient().run_report(RunReportRequest(
    property='properties/510070439',
    date_ranges=[DateRange(start_date='2026-05-01', end_date='today')],
    metrics=[Metric(name='totalUsers')],
    limit=1,
))
print('OK' if r.rows else 'EMPTY')
"
```

Expected: `OK` (or `EMPTY` if window has no data, which is a different problem).
