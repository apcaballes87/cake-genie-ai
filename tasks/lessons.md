# Lessons

- When a user reports a missing side effect in the upload flow, verify the active production path first. In this repo, `ImageContext` is the live customizer upload path, while older hooks may still contain logic that looks correct but is not authoritative.
- For ORB indexing, keep the trigger in the shared cache write flow instead of only in one UI caller. That prevents fresh AI analyses from being cached without `cakegenie_image_features` when different upload surfaces reuse the same backend write helper.
