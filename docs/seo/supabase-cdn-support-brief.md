# Supabase Storage Smart CDN support brief

## Project and scope

- Project reference: `cqmhanqnfybyxezhobkx`
- Public bucket: `cakegenie`
- Affected crawler-facing prefixes: `variants/`, `customizations/`, and `admin/image-studio/`
- Fixed canary: 20 public customizer pages and 38 public image objects

## Problem

We updated the canary objects through the supported Supabase Storage update API
at their existing paths with `X-Robots-Tag: all`.

For each object, the update preserved its exact public URL, SHA-256 bytes, MIME
type, and dimensions. Storage metadata now correctly contains
`xRobotsTag: all`.

Normal canonical public `GET` requests still return a stale edge response:

```text
HTTP: 200 or 206
Content-Type: image/webp
CF-Cache-Status: HIT
X-Robots-Tag: none
```

The same URL's `HEAD` response returns `X-Robots-Tag: all`, showing that
Storage metadata is current but the CDN's public object response is stale.
One measured stale public response had an edge cache age of approximately nine
hours after the update. A diagnostic query-string request returned the same
stale response.

## Reproducible example

```text
https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/variants/blue-minimalist-bento-ivory-bento-cake-00bb/400.webp
```

## Question and requested help

Could you please confirm whether an object's `xRobotsTag` metadata is expected
to be reflected in normal public `GET` responses after an in-place Storage
update?

If it is expected, could you investigate the stale Smart CDN response for the
affected objects and either restore normal public `GET` responses to
`X-Robots-Tag: all` or advise the supported remediation? We have not found a
customer-facing CDN purge operation.

If it is not expected, please advise the supported way to make public Storage
images crawler-eligible without changing their public URLs or object paths.

This is blocking Bing Images eligibility for public custom-cake images. The
application intentionally has not changed image URLs, object paths, image
bytes, sitemaps, or canonical URLs, to avoid a Google Images migration.
