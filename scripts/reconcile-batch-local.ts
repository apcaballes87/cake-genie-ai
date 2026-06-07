import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';
import readline from 'readline';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Load local environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

// Initialize Supabase Admin Client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const STORAGE_BUCKET = 'cakegenie';
const CURRENT_MASK_VERSION = 1;

type Stage = 'studio' | 'mask';

type JsonlResponse = {
  response?: {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  error?: { message?: string };
  request?: { contents?: Array<{ parts?: Array<{ fileData?: { fileUri?: string } | null }> }> };
};

type BatchItem = {
  id: string;
  cache_id: string;
  p_hash: string;
  slug: string | null;
  original_image_url: string;
  studio_edited_image_url: string | null;
  studio_status: string;
  mask_status: string;
};

function parseGcsUri(value: string) {
  const match = value.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${value}`);
  return { bucket: match[1], path: match[2].replace(/\/+$/, '') };
}

function extractImage(line: JsonlResponse) {
  const parts = line.response?.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data)?.inlineData;
  return image?.data ? Buffer.from(image.data, 'base64') : null;
}

function getImageStudioStoragePath({ slug, pHash }: { slug: string | null; pHash: string }) {
  const dir = slug ? `custom-designs/${slug}` : `anonymous-designs/${pHash}`;
  return `${dir}/studio-edit.webp`;
}

async function runLocalReconciliation() {
  console.log('==================================================');
  console.log('   LOCAL BATCH RECONCILIATION WORKER (PLAN B)     ');
  console.log('==================================================');

  // 1. Get the active batch job
  const { data: run, error: runError } = await supabase
    .from('cakegenie_image_studio_batch_jobs')
    .select('*')
    .neq('stage', 'complete')
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (runError) {
    console.error('❌ Failed to fetch active batch job:', runError.message);
    process.exit(1);
  }

  if (!run) {
    console.log('ℹ️ No active batch jobs found. Checking for latest runs...');
    const { data: latest } = await supabase
      .from('cakegenie_image_studio_batch_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (latest && latest.length > 0) {
      console.log('\nRecent runs:');
      latest.forEach(r => console.log(`- ID: ${r.id} | Stage: ${r.stage} | Status: ${r.status}`));
    }
    return;
  }

  console.log(`Active Run ID : ${run.id}`);
  console.log(`Current Stage : ${run.stage}`);
  console.log(`GCP Job Name  : ${run.gemini_job_name}`);
  console.log(`Output GCS URI: ${run.output_file_uri}`);
  console.log('--------------------------------------------------');

  // 2. Fetch all batch items for this run
  console.log('Fetching batch items from Supabase...');
  let itemsQuery = supabase.from('cakegenie_image_studio_batch_items').select('*').eq('batch_job_id', run.id);
  if (run.stage === 'mask') {
    itemsQuery = itemsQuery.eq('studio_status', 'completed');
  }
  const { data: items, error: itemsError } = await itemsQuery;

  if (itemsError || !items) {
    console.error('❌ Failed to fetch batch items:', itemsError?.message);
    process.exit(1);
  }

  console.log(`Loaded ${items.length} batch items for reconciliation.`);

  // Create lookups
  const itemsByUri = new Map<string, BatchItem>();
  for (const item of items) {
    const key = run.stage === 'studio' ? item.original_image_url : item.studio_edited_image_url;
    if (key) {
      itemsByUri.set(key, item);
    }
  }

  // 3. Initialize Google Cloud Storage and find output file
  console.log('Connecting to Google Cloud Storage...');
  const storage = new Storage();
  const { bucket, path: outputPrefix } = parseGcsUri(run.output_file_uri);
  
  const [files] = await storage.bucket(bucket).getFiles({ prefix: outputPrefix });
  const outputFile = files.find((file) => file.name.endsWith('.jsonl'));
  
  if (!outputFile) {
    console.error(`❌ Error: No JSONL output file found in ${run.output_file_uri}`);
    process.exit(1);
  }

  console.log(`Found predictions file: gs://${bucket}/${outputFile.name}`);
  console.log('Downloading and streaming file (exactly once)...');

  // 4. Stream and process line by line
  const stream = outputFile.createReadStream();
  const lines = readline.createInterface({ input: stream });

  let totalLines = 0;
  let processed = 0;
  let skipped = 0;
  let success = 0;
  let failed = 0;

  for await (const rawLine of lines) {
    totalLines++;
    if (!rawLine.trim()) continue;

    let line: JsonlResponse;
    try {
      line = JSON.parse(rawLine) as JsonlResponse;
    } catch {
      continue;
    }

    const parts = line.request?.contents?.flatMap((content) => content.parts ?? []) ?? [];
    const fileUri = parts.find((part) => part?.fileData?.fileUri)?.fileData?.fileUri ?? null;
    
    if (!fileUri) continue;
    
    const item = itemsByUri.get(fileUri);
    if (!item) continue;

    const currentStatus = run.stage === 'studio' ? item.studio_status : item.mask_status;
    if (currentStatus === 'completed') {
      skipped++;
      continue;
    }

    processed++;
    process.stdout.write(`\rProcessing item ${processed}... `);

    try {
      const image = extractImage(line);
      if (!image) {
        throw new Error(line.error?.message ?? 'No image returned by Vertex AI.');
      }

      if (run.stage === 'studio') {
        // Fetch slug from database to be accurate
        const { data: cacheRow } = await supabase
          .from('cakegenie_analysis_cache')
          .select('slug')
          .eq('id', item.cache_id)
          .single();

        const latestSlug = cacheRow?.slug || item.slug;
        const storagePath = getImageStudioStoragePath({ slug: latestSlug, pHash: item.p_hash });
        
        // Convert to webp
        const webp = await sharp(image).webp({ quality: 92, effort: 4 }).toBuffer();
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, webp, { contentType: 'image/webp', upsert: true });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

        // Update database cache
        const { error: cacheUpdateError } = await supabase
          .from('cakegenie_analysis_cache')
          .update({ 
            studio_edited_image_url: urlData.publicUrl, 
            studio_edit_status: 'completed', 
            studio_edited_at: new Date().toISOString() 
          })
          .eq('id', item.cache_id);

        if (cacheUpdateError) throw cacheUpdateError;

        // Update batch item
        const { error: itemUpdateError } = await supabase
          .from('cakegenie_image_studio_batch_items')
          .update({ 
            studio_status: 'completed', 
            studio_edited_image_url: urlData.publicUrl, 
            error: null 
          })
          .eq('id', item.id);

        if (itemUpdateError) throw itemUpdateError;

      } else {
        // Stage is 'mask'
        const storagePath = `icing-masks/${item.cache_id}/v${CURRENT_MASK_VERSION}.png`;
        
        // Convert to png
        const png = await sharp(image).png().toBuffer();
        const metadata = await sharp(png).metadata();
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, png, { contentType: 'image/png', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

        // Upsert mask record
        const { error: maskUpsertError } = await supabase
          .from('cakegenie_icing_masks')
          .upsert({
            cache_id: item.cache_id, 
            mask_url: `${urlData.publicUrl}?t=${Date.now()}`,
            source_image_url: item.studio_edited_image_url, 
            mask_version: CURRENT_MASK_VERSION,
            width: metadata.width, 
            height: metadata.height, 
            status: 'ready',
          }, { onConflict: 'cache_id,mask_version' });

        if (maskUpsertError) throw maskUpsertError;

        // Update batch item
        const { error: itemUpdateError } = await supabase
          .from('cakegenie_image_studio_batch_items')
          .update({ 
            mask_status: 'completed', 
            error: null 
          })
          .eq('id', item.id);

        if (itemUpdateError) throw itemUpdateError;
      }

      success++;
    } catch (err: any) {
      failed++;
      const errMsg = err.message || 'Error processing line';
      console.error(`\n❌ Error processing item ${item.p_hash}: ${errMsg}`);
      
      // Update item status in database
      await supabase
        .from('cakegenie_image_studio_batch_items')
        .update({ 
          [`${run.stage}_status`]: 'failed', 
          error: errMsg 
        })
        .eq('id', item.id);
    }
  }

  console.log(`\nReconciliation completed for this pass.`);
  console.log(`--------------------------------------------------`);
  console.log(`Total lines read : ${totalLines}`);
  console.log(`Skipped (done)   : ${skipped}`);
  console.log(`Newly processed  : ${processed}`);
  console.log(`  - Success      : ${success}`);
  console.log(`  - Failed       : ${failed}`);
  console.log(`--------------------------------------------------`);

  // Check if anything is left for this stage
  const { count: remaining } = await supabase
    .from('cakegenie_image_studio_batch_items')
    .select('id', { count: 'exact', head: true })
    .eq('batch_job_id', run.id)
    .in(run.stage === 'studio' ? 'studio_status' : 'mask_status', ['pending', 'submitted']);

  if (remaining === 0) {
    if (run.stage === 'mask') {
      // Completed the entire batch job!
      console.log('🎉 Successfully reconciled all items for the entire batch!');
      const status = failed ? 'completed_with_errors' : 'completed';
      await supabase
        .from('cakegenie_image_studio_batch_jobs')
        .update({ 
          status, 
          stage: 'complete', 
          completed_requests: success + skipped, 
          failed_requests: failed, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', run.id);
      
      await supabase
        .from('cakegenie_analysis_cache')
        .update({ batch_job_id: null })
        .eq('batch_job_id', run.id);
    } else {
      // Completed studio stage, transition to mask stage!
      console.log('🔄 Studio stage completed. Transitioning run to "mask" stage...');
      
      // Setup the next stage's inputs (matching reconcileImageStudioBatch)
      const refreshed = await supabase
        .from('cakegenie_image_studio_batch_items')
        .select('*')
        .eq('batch_job_id', run.id)
        .eq('studio_status', 'completed')
        .order('created_at');

      const ready = refreshed.data as BatchItem[];
      
      if (ready.length === 0) {
        console.log('⚠️ No items completed studio stage successfully. Ending batch.');
        await supabase
          .from('cakegenie_image_studio_batch_jobs')
          .update({ 
            status: 'completed_with_errors', 
            stage: 'complete', 
            updated_at: new Date().toISOString() 
          })
          .eq('id', run.id);
      } else {
        console.log(`Submitting mask stage with ${ready.length} ready items...`);
        // User needs to submit the mask stage through the GCP console or we can tell them
        console.log('👉 Please log in to the admin dashboard or run reconciliation again to let the server start the mask stage.');
      }
    }
  } else {
    console.log(`⚠️ Warning: ${remaining} items are still marked as pending/submitted. Run the script again if needed.`);
  }
}

runLocalReconciliation().catch(console.error);
