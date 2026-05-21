# Lessons

- When a user reports a missing side effect in the upload flow, verify the active production path first. In this repo, `ImageContext` is the live customizer upload path, while older hooks may still contain logic that looks correct but is not authoritative.
- For ORB indexing, keep the trigger in the shared cache write flow instead of only in one UI caller. That prevents fresh AI analyses from being cached without `cakegenie_image_features` when different upload surfaces reuse the same backend write helper.
- When a server route needs to wrap a Node `Buffer` in a `Blob` for shared helpers, convert it to `Uint8Array.from(buffer)` first. Next 16 / TypeScript can reject `Buffer` as a direct `BlobPart` in production builds even when local edits look fine.
- When a change touches build-time data paths, verify with a full `npm run build`, not just type checks or focused tests. In this repo, prerender can surface extra production-only issues like missing live-schema columns or Supabase RPC timeouts.
