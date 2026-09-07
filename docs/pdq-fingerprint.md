# Server-side PDQ fingerprinting

Genie uses Facebook ThreatExchange PDQ for similarity matching. The browser
uploads an image to `/api/image/fingerprint`; the Next.js Node.js route
normalizes the image with Sharp and computes PDQ through the pinned
`pdq-wasm@0.3.9` WebAssembly binding. The browser never computes or compares a
fingerprint.

## Runtime contract

- The route must remain on the Node.js runtime, not the Edge runtime.
- The legacy 16-character dHash remains an opaque compatibility value for
  cache identity and foreign keys.
- PDQ returns a lowercase 64-character hexadecimal hash, quality, status, and
  the versioned pipeline identifier exported as `PDQ_PIPELINE`.
- Quality below `50` is returned as `low_quality` and is never eligible for
  similarity matching.
- Similarity uses the configured PDQ Hamming threshold of `35` and exact
  pipeline matching in Supabase.

## Deterministic normalization

The PDQ input pipeline applies EXIF orientation, sRGB conversion, alpha
flattening onto white, Lanczos3 containment in a 512×512 canvas without
upscaling smaller source images, and RGB raw-pixel extraction. The WASM hash
serialization is converted to the same word order used by
`threatexchange==1.2.16` so existing reference vectors remain comparable.

The pipeline identifier must change whenever the decoder, normalization,
WASM implementation, or serialization changes. Do not silently mix hashes from
different pipelines.

## Cache and rollout

Apply the additive PDQ migration before deploying application code that writes
the new columns. Run:

```bash
npm run backfill:pdq -- --dry-run --limit=50
```

The backfill downloads `original_image_url`, computes PDQ in the same Next.js
server module, and supports bounded concurrency, retries, and resumable status
handling. It never changes legacy `p_hash` values, foreign keys, aliases, or
duplicate rows.

For the full resumable run, use:

```bash
npm run backfill:pdq -- --all --limit=50 --concurrency=4 --retries=3
```

Each completed row stores its status and timestamp in Supabase. If the laptop
or terminal stops, run the same command again; completed rows are skipped and
the remaining `pending` rows continue. Use `--retry-failed` on a later run to
retry rows explicitly marked `failed`. Do not combine `--all` with
`--dry-run`, because a dry run does not persist progress.

After applying the migration, verify the cache columns, ready-row index,
`pdq_hamming_distance`, and `find_similar_analysis_by_pdq` in the target
Supabase project before starting the backfill. Check representative ready,
low-quality, missing-source, and failed counts, then exercise one live PDQ
lookup against a known ready row.

If rollout is paused or reverted, deploy the previous application version and
leave the additive PDQ columns and RPCs in place. Do not rewrite legacy pHash
references or remove historical ORB objects as part of rollback.

## Compatibility verification

`src/lib/server/imageFingerprint.test.ts` includes a repository fixture whose
WASM output is checked against the pinned Python reference output. Before
changing `PDQ_PIPELINE`, add representative originals, re-encodings, resizing,
device/browser variants, crops, edits, unrelated images, visually similar
cakes, and low-detail images to the fixture matrix and record false positives
and false negatives at distance `35`.

Run the local crop diagnostic with:

```bash
npm run benchmark:pdq-crops -- path/to/original.webp
```

The benchmark generates exact, re-encoded, resized, and controlled crop
variants. It reports the current production normalization alongside
experimental white-border trimming and center-cover normalization. The
experimental paths are diagnostic only; they do not participate in cache
matching or change `PDQ_PIPELINE`.

The three live Kuromi originals that produced the earlier `78` and `110`
observations were visually the same cake with different framing. Running them
through the current pipeline produced pairwise distances of `80`, `108`, and
`78`; trim did not improve them, while center-cover produced `80`, `130`, and
`106`. This confirms that raising the global threshold is not a safe fix.
