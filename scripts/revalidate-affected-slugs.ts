/**
 * scripts/revalidate-affected-slugs.ts
 *
 * Optional immediate-refresh helper for the `strip_id_leak_v1` SQL migration.
 *
 * Companion to:
 *   - supabase/migrations/20260526120000_strip_id_leak_from_seo_title.sql
 *   - supabase/migrations/20260526120000_strip_id_leak_from_seo_title.runbook.md
 *     (Step 6: "Wait for ISR refresh, or force it")
 *
 * What this does
 *   Reads every slug recorded in `cakegenie_analysis_cache_seo_title_backup`
 *   for a given `migration_id` (default `strip_id_leak_v1`), then either:
 *     (a) [default — dry run] prints those slugs to stdout, one per line,
 *         along with a suggested curl-warming command; or
 *     (b) [--apply]            issues an HTTP GET against
 *         `<site-url>/customizing/<slug>` for every slug, which warms the
 *         ISR cache and forces a fresh server render (provided the
 *         `revalidate = 3600` window has elapsed since `strip_id_leak_apply()`
 *         was run, OR the on-demand revalidation API has been hit).
 *
 * Why HTTP GET instead of `revalidatePath`?
 *   This codebase does not currently expose an `/api/revalidate` route or any
 *   server action that calls Next.js's `revalidatePath`. Until one ships,
 *   the operator-facing options for an immediate refresh are:
 *     1. Wait for ISR_Window (3600 s) to elapse, then any incoming GET
 *        against `/customizing/<slug>` triggers a fresh render. This script
 *        with `--apply` performs that GET on the operator's behalf for every
 *        affected slug in one pass.
 *     2. Add an on-demand revalidation API. Out of scope for this task.
 *
 * Usage
 *   npx tsx scripts/revalidate-affected-slugs.ts                     # dry run
 *   npx tsx scripts/revalidate-affected-slugs.ts --apply             # warm ISR
 *   npx tsx scripts/revalidate-affected-slugs.ts \
 *     --migration-id strip_id_leak_v1 \
 *     --site-url https://genie.ph \
 *     --apply
 *   npx tsx scripts/revalidate-affected-slugs.ts --help              # usage
 *
 * CLI flags
 *   --migration-id <id>   default: strip_id_leak_v1
 *   --site-url <url>      default: https://genie.ph
 *   --token <token>       default: process.env.REVALIDATE_TOKEN
 *                         (currently unused — reserved for a future
 *                         /api/revalidate route)
 *   --apply               actually issue HTTP GETs (default is dry run)
 *   --dry-run             explicit dry run (default behavior)
 *   --help                print this usage and exit 0
 *
 * Environment (loaded from .env.local via dotenv)
 *   NEXT_PUBLIC_SUPABASE_URL       required
 *   SUPABASE_SERVICE_ROLE_KEY      required (anon key falls back but the
 *                                  backup table is service-role-only writable)
 *   REVALIDATE_TOKEN               optional, reserved
 *
 * Exit codes
 *   0  success (zero slugs is also success)
 *   1  bad CLI args
 *   2  missing env / Supabase credentials
 *   3  Supabase query error
 *   4  one or more HTTP warm requests failed in --apply mode
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

interface CliArgs {
  migrationId: string;
  siteUrl: string;
  token: string | undefined;
  apply: boolean;
  help: boolean;
}

const USAGE = `Usage: npx tsx scripts/revalidate-affected-slugs.ts [options]

Reads slugs from cakegenie_analysis_cache_seo_title_backup for a given
migration_id and either prints them (dry run, default) or warms the ISR
cache by issuing an HTTP GET against <site-url>/customizing/<slug>
for each (--apply).

Options:
  --migration-id <id>   migration_id to filter on (default: strip_id_leak_v1)
  --site-url <url>      site to warm (default: https://genie.ph)
  --token <token>       reserved for /api/revalidate (default: $REVALIDATE_TOKEN)
  --apply               actually issue HTTP GETs (default: dry run only)
  --dry-run             explicit dry run (default behavior)
  --help                show this message and exit
`;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    migrationId: 'strip_id_leak_v1',
    siteUrl: 'https://genie.ph',
    token: process.env.REVALIDATE_TOKEN,
    apply: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--apply':
        args.apply = true;
        break;
      case '--dry-run':
        args.apply = false;
        break;
      case '--migration-id': {
        const value = argv[++i];
        if (!value) {
          console.error('error: --migration-id requires a value');
          process.exit(1);
        }
        args.migrationId = value;
        break;
      }
      case '--site-url': {
        const value = argv[++i];
        if (!value) {
          console.error('error: --site-url requires a value');
          process.exit(1);
        }
        args.siteUrl = value.replace(/\/+$/, '');
        break;
      }
      case '--token': {
        const value = argv[++i];
        if (!value) {
          console.error('error: --token requires a value');
          process.exit(1);
        }
        args.token = value;
        break;
      }
      default:
        console.error(`error: unknown argument "${flag}"`);
        console.error(USAGE);
        process.exit(1);
    }
  }

  return args;
}

interface BackupRow {
  slug: string;
}

async function fetchAffectedSlugs(
  supabaseUrl: string,
  supabaseKey: string,
  migrationId: string,
): Promise<string[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const PAGE_SIZE = 1000;
  const slugs: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache_seo_title_backup')
      .select('slug')
      .eq('migration_id', migrationId)
      .order('slug', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    const rows: BackupRow[] = data ?? [];
    for (const row of rows) {
      if (typeof row.slug === 'string' && row.slug.length > 0) {
        slugs.push(row.slug);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // De-duplicate: a slug can appear more than once if multiple migration runs
  // touched it (different backed_up_at timestamps share the migration_id).
  return Array.from(new Set(slugs));
}

async function warmSlug(
  siteUrl: string,
  slug: string,
): Promise<{ slug: string; ok: boolean; status: number; error?: string }> {
  const url = `${siteUrl}/customizing/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Hint that this is a cache-warming probe, not a real user.
        'User-Agent': 'genieph-revalidate-affected-slugs/1.0',
      },
    });
    return { slug, ok: res.ok, status: res.status };
  } catch (err) {
    return {
      slug,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local',
    );
    return 2;
  }

  let slugs: string[];
  try {
    slugs = await fetchAffectedSlugs(supabaseUrl, supabaseKey, args.migrationId);
  } catch (err) {
    console.error(
      `error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 3;
  }

  console.error(
    `[revalidate-affected-slugs] migration_id=${args.migrationId} site=${args.siteUrl} mode=${args.apply ? 'apply' : 'dry-run'} slugs=${slugs.length}`,
  );

  if (slugs.length === 0) {
    console.error('[revalidate-affected-slugs] 0 slugs to refresh — nothing to do.');
    return 0;
  }

  if (!args.apply) {
    // Dry run: print slugs (one per line, stdout) so operators can pipe to
    // xargs / curl. Status messages go to stderr so stdout stays grep-friendly.
    for (const slug of slugs) {
      process.stdout.write(`${slug}\n`);
    }
    console.error('');
    console.error(
      '[revalidate-affected-slugs] DRY RUN — no HTTP requests issued.',
    );
    console.error(
      '[revalidate-affected-slugs] To warm ISR for each slug, either:',
    );
    console.error(
      `[revalidate-affected-slugs]   1. Re-run with --apply, OR`,
    );
    console.error(
      `[revalidate-affected-slugs]   2. Pipe the slugs above through curl, e.g.:`,
    );
    console.error(
      `[revalidate-affected-slugs]      npx tsx scripts/revalidate-affected-slugs.ts --migration-id ${args.migrationId} \\`,
    );
    console.error(
      `[revalidate-affected-slugs]        | xargs -I{} curl -sS "${args.siteUrl}/customizing/{}" -o /dev/null -w "%{http_code} {}\\n"`,
    );
    console.error(
      '[revalidate-affected-slugs] Note: ISR_Window (3600 s) must have elapsed since strip_id_leak_apply() ran, otherwise the GET still serves the cached pre-strip render.',
    );
    return 0;
  }

  // Apply mode: warm each slug. Cap concurrency at 8 to stay polite.
  const CONCURRENCY = 8;
  const results: Array<{ slug: string; ok: boolean; status: number; error?: string }> = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < slugs.length) {
      const idx = cursor++;
      const slug = slugs[idx];
      const result = await warmSlug(args.siteUrl, slug);
      results.push(result);
      const tag = result.ok ? 'OK' : 'FAIL';
      console.error(
        `[revalidate-affected-slugs] [${idx + 1}/${slugs.length}] ${tag} status=${result.status} slug=${slug}${result.error ? ` error=${result.error}` : ''}`,
      );
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, slugs.length) }, () => worker());
  await Promise.all(workers);

  const failed = results.filter((r) => !r.ok);
  console.error('');
  console.error(
    `[revalidate-affected-slugs] done: ${results.length - failed.length} ok, ${failed.length} failed.`,
  );

  if (failed.length > 0) {
    console.error('[revalidate-affected-slugs] failures:');
    for (const f of failed) {
      console.error(
        `[revalidate-affected-slugs]   ${f.slug}  status=${f.status}${f.error ? ` error=${f.error}` : ''}`,
      );
    }
    return 4;
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(
      `error: ${err instanceof Error ? err.stack || err.message : String(err)}`,
    );
    process.exit(1);
  });
