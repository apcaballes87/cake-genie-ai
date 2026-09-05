import { Storage } from '@google-cloud/storage';
import readline from 'node:readline';
import { revalidatePath } from 'next/cache';
import { getAI, getGoogleCloudAuthOptions } from '@/lib/ai/client';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { submitIndexNow } from '@/lib/indexNow';
import { buildSeoPublicationMetadata, buildSeoBatchInput } from './seoPublication';
import { buildSeoBatchInputLine, getSeoOutputItemId, parseSeoBatchOutput, type SeoBatchItem, type SeoBatchOutput } from './seoBatchContract';
import { getSeoPromptDetails } from '@/services/prompts/promptLoader';

type Context = { headers?: { get(name: string): string | null | undefined } } | null | undefined;
const RUNS = 'cakegenie_seo_batch_runs';
const JOBS = 'cakegenie_seo_batch_jobs';
const MODEL = 'gemini-3.5-flash-lite';
const MAX_IMPORTS = 50;
function gcsLocation(uri: string) {
  const match = uri.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error('VERTEX_AI_BATCH_GCS_URI must be a writable gs:// bucket prefix.');
  return { bucket: match[1], path: match[2].replace(/\/+$/, '') };
}
function checked<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

/**
 * Finalization is transactional; crawler notification is deliberately a
 * separate durable step so a transient IndexNow outage never reruns paid AI.
 */
async function notifyPublishedSeoJobs(admin: ReturnType<typeof createAdminServerSupabaseClient>) {
  const { data: jobs, error: jobsError } = await admin
    .from(JOBS)
    .select('id,cache_id,slug')
    .eq('status', 'completed')
    .is('notification_sent_at', null)
    .limit(100);
  if (jobsError) throw jobsError;
  if (!jobs?.length) return 0;

  const cacheIds = jobs.map(job => job.cache_id);
  const { data: cacheRows, error: cacheError } = await admin
    .from('cakegenie_analysis_cache')
    .select('id,slug')
    .eq('seo_status', 'published')
    .in('id', cacheIds);
  if (cacheError) throw cacheError;
  const publishedById = new Map((cacheRows || [])
    .filter(row => typeof row.slug === 'string' && row.slug.trim())
    .map(row => [row.id, row.slug.trim()]));
  const jobsToNotify = jobs.filter(job => publishedById.has(job.cache_id));
  if (!jobsToNotify.length) return 0;

  const urls = jobsToNotify.map(job => `https://genie.ph/customizing/${encodeURIComponent(publishedById.get(job.cache_id)!)}`);
  const results = await submitIndexNow(urls);
  if (!results.some(result => result.ok)) {
    throw new Error('IndexNow did not accept any published SEO URLs.');
  }
  for (const slug of publishedById.values()) {
    revalidatePath(`/customizing/${slug}`);
  }
  revalidatePath('/');
  revalidatePath('/search');
  revalidatePath('/collections', 'layout');
  revalidatePath('/sitemap-html');
  revalidatePath('/sitemap-index.xml');
  revalidatePath('/sitemap-images.xml');
  const { error: updateError } = await admin
    .from(JOBS)
    .update({ notification_sent_at: new Date().toISOString() })
    .in('id', jobsToNotify.map(job => job.id));
  if (updateError) throw updateError;
  return jobsToNotify.length;
}

export async function runSeoBatchWorker(context?: Context) {
  const admin = createAdminServerSupabaseClient();
  const notified = await notifyPublishedSeoJobs(admin);
  const storage = new Storage(getGoogleCloudAuthOptions(context));
  const { data: active } = checked(await admin.from(RUNS).select('*').in('status', ['collecting', 'submitted', 'importing']).limit(1).maybeSingle());
  if (active) {
    // A collecting run with no provider identifier is intentionally held for operator review.
    // Retrying an ambiguous create response can cause duplicate charges.
    if (active.status === 'collecting') return { status: 'collecting', runId: active.id, needsReview: true, notified };
    const { data: jobs } = checked(await admin.from(JOBS).select('*').eq('run_id', active.id).eq('status', 'submitted'));
    const items = (jobs ?? []) as (SeoBatchItem & { availability?: string })[];
    const fail = async (item: SeoBatchItem, error: string) => {
      checked(await admin.rpc('fail_seo_batch_item', { p_job_id: item.id, p_run_id: active.id, p_error: error }));
    };
    if (active.status === 'submitted') {
      // Poll errors leave the existing job attached: transient 403/503 must never resubmit work.
      const provider = await (await getAI(context)).batches.get({ name: active.gemini_job_name });
      if (provider.state !== 'JOB_STATE_SUCCEEDED') {
        if (/FAILED|CANCELLED|CANCELED|EXPIRED/.test(provider.state ?? '')) {
          const reason = JSON.stringify({ state: provider.state, error: provider.error });
          for (const item of items) await fail(item, reason);
          checked(await admin.from(RUNS).update({ status: 'failed', error: reason, updated_at: new Date().toISOString() }).eq('id', active.id));
          return { status: 'failed', runId: active.id, notified };
        }
        return { status: provider.state, runId: active.id, notified };
      }
      checked(await admin.from(RUNS).update({ status: 'importing', updated_at: new Date().toISOString() }).eq('id', active.id));
    }
    const output = gcsLocation(active.output_file_uri);
    const [files] = await storage.bucket(output.bucket).getFiles({ prefix: output.path });
    const jsonlFiles = files.filter(file => file.name.endsWith('.jsonl')).sort((a, b) => a.name.localeCompare(b.name));
    if (!jsonlFiles.length) throw new Error('Completed SEO batch has no JSONL output yet.');
    const byId = new Map(items.map(item => [item.id, item]));
    let imported = 0;
    let published = 0;
    let exhausted = true;
    for (const file of jsonlFiles) {
      const stream = file.createReadStream();
      const lines = readline.createInterface({ input: stream });
      try {
        for await (const raw of lines) {
          if (imported >= MAX_IMPORTS) { exhausted = false; break; }
          let outputLine: SeoBatchOutput;
          try { outputLine = JSON.parse(raw); } catch { continue; }
          const id = getSeoOutputItemId(outputLine);
          const item = id ? byId.get(id) : undefined;
          if (!item) continue;
          byId.delete(item.id);
          imported++;
          let metadata;
          try {
            metadata = buildSeoPublicationMetadata(
              item.analysis_json as unknown as Parameters<typeof buildSeoPublicationMetadata>[0],
              parseSeoBatchOutput(outputLine),
              item.availability as Parameters<typeof buildSeoPublicationMetadata>[2],
            );
          } catch (error) { await fail(item, message(error)); continue; }
          // Database/transport failures bubble up so the next poll can safely repeat finalization.
          const { data: didPublish } = checked(await admin.rpc('finalize_seo_batch_item', {
            p_job_id: item.id, p_run_id: active.id, p_analysis_revision: item.analysis_revision,
            p_seo_title: metadata.seo_title, p_seo_description: metadata.seo_description,
            p_alt_text: metadata.alt_text, p_tags: metadata.tags,
            p_usage_metadata: outputLine.response?.usageMetadata ?? {},
          }));
          if (didPublish) published++;
        }
      } finally { lines.close(); stream.destroy(); }
      if (!exhausted) break;
    }
    if (exhausted) for (const item of byId.values()) await fail(item, 'Completed batch omitted this item.');
    const { count } = checked(await admin.from(JOBS).select('id', { head: true, count: 'exact' }).eq('run_id', active.id).eq('status', 'submitted'));
    if (!count) checked(await admin.from(RUNS).update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', active.id));
    return { status: count ? 'importing' : 'completed', runId: active.id, imported, published, notified };
  }

  if (process.env.SEO_BATCH_SUBMISSIONS_ENABLED !== 'true') return { status: 'submissions_disabled', notified };
  const location = gcsLocation(process.env.VERTEX_AI_BATCH_GCS_URI?.trim() ?? '');
  const runId = crypto.randomUUID();
  const { promptText, version } = await getSeoPromptDetails();
  const { data } = checked(await admin.rpc('claim_seo_batch', { p_run_id: runId, p_limit: 1000, p_prompt_version: version }));
  const items = (data ?? []) as SeoBatchItem[];
  if (!items.length) return { status: 'idle', notified };
  const root = [location.path, 'cake-seo', runId].filter(Boolean).join('/');
  const inputUri = `gs://${location.bucket}/${root}/input.jsonl`;
  const outputUri = `gs://${location.bucket}/${root}/output`;
  checked(await admin.from(RUNS).update({ input_file_uri: inputUri, output_file_uri: outputUri }).eq('id', runId));
  try {
    await storage.bucket(location.bucket).file(`${root}/input.jsonl`).save(items.map(item => buildSeoBatchInputLine({ ...item, analysis_json: buildSeoBatchInput(item.analysis_json as unknown as Parameters<typeof buildSeoBatchInput>[0]) }, promptText)).join('\n'), { contentType: 'application/jsonl' });
    const provider = await (await getAI(context)).batches.create({ model: MODEL, src: { gcsUri: [inputUri], format: 'jsonl' }, config: { displayName: `cakegenie-seo-${runId}`, dest: { gcsUri: outputUri, format: 'jsonl' } } });
    if (!provider.name) throw new Error('Vertex batch creation did not return a job name.');
    checked(await admin.from(RUNS).update({ gemini_job_name: provider.name, status: 'submitted', updated_at: new Date().toISOString() }).eq('id', runId));
    return { status: 'submitted', runId, submitted: items.length, notified };
  } catch (error) {
    checked(await admin.from(RUNS).update({ error: message(error), updated_at: new Date().toISOString() }).eq('id', runId));
    throw error;
  }
}
