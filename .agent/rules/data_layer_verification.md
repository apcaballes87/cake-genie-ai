# Data Layer Verification Rules

Guidelines for verifying schema assumptions before writing code that depends on them.

## 1. Schema Assumptions vs Production Reality

### Rule: Verify Foreign Keys / Join Columns Against the Live Database Before Writing Helper Code

When a feature plan or design document specifies a "join key" or "foreign key" relationship between tables (e.g., "reviews link to designs via `product_id`"), you **MUST** verify the column actually exists on the referenced table before writing code that depends on it. Plans written from first principles frequently get the schema wrong, and the test suite will not catch it if the helper is mocked at a layer above the actual query.

> [!CAUTION]
> Unit tests with mocked supabase clients will pass even when the real query is broken. The integration test that would have caught a missing column is the one that queries against the live database — and most helper-level unit tests skip that step.

**Verification Protocol (run BEFORE writing the helper):**

1. **List the columns you assume exist.** Write them down in a comment block at the top of the helper file.
2. **Query the live database's information schema** (or equivalent) to confirm each column actually exists.
   - If you have anon API access: `GET /rest/v1/<table>?select=<col>&limit=0` — a 400 "column does not exist" error confirms the column is missing.
   - If you have full DB access: query `information_schema.columns` directly.
3. **Check the data shape.** Don't just confirm the column exists — confirm it has the values you expect. Run a query that exercises the join you'd write (e.g., "find a review whose X matches a design's X") to verify the linkage is real.
4. **If the schema doesn't match, trace the actual join path.** Look at the sample rows for the most-recent records in each table. Look at what fields are populated vs `null`. The real join key is usually obvious once you have 5 rows of each table side-by-side.

**Anti-pattern: trusting the design doc over the database.**

```ts
// ❌ BAD: plan says "reviews link to designs via product_id"
// helper written and unit tests pass with a mocked supabase
export async function getThemedReviewsForSlug(productId: string, ...) {
  await supabase.from('cakegenie_reviews').eq('product_id', productId)...
}

// 3 weeks later, on the live site, the section is always empty.
// The user can see the page but never the reviews.

// ✅ GOOD: verify the join key first
// 1. design schema: cakegenie_analysis_cache has product_id? → "column does not exist"
// 2. look at actual data: design.original_image_url is set, review.original_image_url
//    is set, they match for the same cake → real join key is original_image_url
// 3. NOW write the helper:
export async function getThemedReviewsForSlug(designImageUrl: string, ...) {
  await supabase.from('cakegenie_reviews').eq('original_image_url', designImageUrl)...
}
```

**What unit tests should cover (and what they can't):**

| Test type | Catches missing columns? | Catches wrong join semantics? |
|---|---|---|
| Pure unit (mocked supabase) | ❌ No — mock returns whatever you tell it | ❌ No — same reason |
| Integration (real supabase, test DB) | ✅ Yes — real schema | ✅ Yes — real data |
| Live curl / fetch from prod | ✅ Yes — real schema | ✅ Yes — real data |
| E2E browser test | ✅ Yes (indirectly) | ✅ Yes (indirectly) |

**Rule of thumb:** if your unit tests pass but the feature doesn't work in production, the schema assumption is the first place to look. Run `npx tsc --noEmit`, run the tests, and if both are green — **the bug is at the integration boundary**, not in your code.

---

## 2. When to Bypass the Rule (Rare)

This rule can be bypassed **only** when:

- You're writing code for a new feature on a not-yet-deployed table whose schema you control directly (e.g., a brand-new migration in the same PR).
- The "join" is purely an in-memory key, not a database column.
- The plan explicitly states the column is being added in the same PR and you can see the migration file.

In every other case, the rule applies. The cost of a 5-minute schema check is much lower than the cost of a "plan is half-applied" debugging session three weeks later.

---

## 3. The "Plan is Half-Applied" Diagnostic Pattern

When you notice a feature is **partially** working on the live site (e.g., the section renders but the star average is wrong, or the data is showing but the JSON-LD is wrong), the most likely cause is a schema-mismatch at the join boundary. Specifically:

1. **Identify the join key** the feature depends on (the foreign key, the URL match, the slug).
2. **Run a curl against the live data** to confirm both sides of the join have the expected value.
3. **If the data is there but the join isn't matching**, the helper is querying the wrong field. Update the helper to use the correct field.
4. **If the data is missing on one side**, that's a data-quality issue, not a code issue — escalate to whoever owns the data.

**Diagnostic checklist for "feature isn't showing in prod but tests are green":**

- [ ] Does the page actually receive the data? (check network tab, server logs)
- [ ] Does the data have the field the helper is querying? (curl the row)
- [ ] Does the helper query use the same field? (read the source)
- [ ] Is the page-level short-circuit (e.g., `if (!design.foo) return []`) firing for every page? (read the source)
- [ ] Is the live page using a different code path than the test? (check ISR cache, deployment status)
- [ ] Is the live page using a different code path than the test? **(yes, this is intentionally listed twice — the deployment-cache answer is the most common one for "works in test, doesn't work in prod" bugs)**
