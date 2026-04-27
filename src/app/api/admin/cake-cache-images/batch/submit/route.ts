import { NextRequest, NextResponse } from 'next/server';
import { createPublicServerSupabaseClient } from '@/lib/supabase/publicServer';
import { getAI, getAIClientDiagnostics } from '@/lib/ai/client';
import { buildImageStudioPrompt, buildImageStudioSystemInstruction, ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const MODEL_NAME = 'gemini-3.1-flash-image-preview';

const isAuthorized = (req: NextRequest) => {
  return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
};

const detectMimeType = (url: string, fallback: string | null) => {
  if (fallback?.startsWith('image/')) return fallback;
  const extension = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'svg': return 'image/svg+xml';
    default: return 'image/jpeg';
  }
};

const fetchImageAsInlineData = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = detectMimeType(url, response.headers.get('content-type'));
  return {
    data: Buffer.from(arrayBuffer).toString('base64'),
    mimeType,
  };
};

export const POST = async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createPublicServerSupabaseClient();
  const aiClient = getAI(req);
  const diagnostics = getAIClientDiagnostics(req);

  // For batch processing via JSONL files uploaded directly to the Gemini API,
  // we must be using the API Key (AI Studio) mode. Vertex AI requires GCS buckets.
  if (diagnostics.mode === 'vertex') {
    return NextResponse.json(
      { error: 'Batch jobs are currently configured for AI Studio only (requires GOOGLE_AI_API_KEY). Vertex AI requires additional Google Cloud Storage bucket configuration.' },
      { status: 400 }
    );
  }

  try {
    const { data: rows, error: fetchError } = await supabase
      .from('cakegenie_analysis_cache')
      .select('p_hash, original_image_url')
      .in('studio_edit_status', ['not_started', 'failed'])
      .not('original_image_url', 'is', null)
      .neq('original_image_url', '')
      .limit(50); // limit to a reasonable batch size per request

    if (fetchError) throw new Error(`Failed to fetch rows: ${fetchError.message}`);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: 'No images pending for batch processing.', imagesEnqueued: 0 });
    }

    const tmpFilePath = path.join(os.tmpdir(), `batch_input_${Date.now()}.jsonl`);
    const writeStream = fs.createWriteStream(tmpFilePath);
    const prompt = buildImageStudioPrompt();
    const systemInstruction = buildImageStudioSystemInstruction();
    
    let processedCount = 0;
    const processedPHashes: string[] = [];

    for (const row of rows) {
      if (!row.original_image_url) continue;
      try {
        const inlineData = await fetchImageAsInlineData(row.original_image_url);
        
        // Format for @google/genai batch API
        const requestObj = {
          id: row.p_hash, // User-defined ID to map back the results
          request: {
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: inlineData.mimeType, data: inlineData.data } },
                  { text: prompt }
                ]
              }
            ],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              responseModalities: ["IMAGE"]
            }
          }
        };

        writeStream.write(JSON.stringify(requestObj) + '\n');
        processedPHashes.push(row.p_hash);
        processedCount++;
      } catch (e) {
        console.warn(`[Batch API] Skipping image ${row.p_hash}: ${e}`);
      }
    }
    
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(undefined));
      writeStream.on('error', reject);
    });

    if (processedCount === 0) {
      return NextResponse.json({ message: 'No valid images to process.', imagesEnqueued: 0 });
    }

    // Upload to Gemini File API
    const uploadedFile = await aiClient.files.upload({
      file: tmpFilePath,
      config: {
        mimeType: 'application/jsonlines',
        displayName: `ImageStudioBatch_${Date.now()}`
      }
    });

    if (!uploadedFile.name) {
      throw new Error('Failed to get uploaded file name.');
    }

    // Create Batch Job
    const batchJob = await aiClient.batches.create({
      model: MODEL_NAME,
      src: uploadedFile.name,
    });

    // Save to tracking table
    const { data: jobRow, error: jobInsertError } = await supabase
      .from('cakegenie_image_studio_batch_jobs')
      .insert({
        gemini_job_name: batchJob.name,
        input_file_uri: uploadedFile.name,
        total_requests: processedCount,
        status: 'pending' // pending until we sync
      })
      .select('id')
      .single();

    if (jobInsertError) {
      throw new Error(`Failed to save batch job to DB: ${jobInsertError.message}`);
    }

    // Update the pending rows so they are associated with the batch
    await supabase
      .from('cakegenie_analysis_cache')
      .update({
        studio_edit_status: 'processing',
        batch_job_id: jobRow.id,
        studio_edit_error: null
      })
      .in('p_hash', processedPHashes);

    // Clean up tmp file
    fs.unlinkSync(tmpFilePath);

    return NextResponse.json({
      message: 'Batch job submitted successfully',
      batchJobId: jobRow.id,
      geminiJobName: batchJob.name,
      imagesEnqueued: processedCount
    });

  } catch (error: any) {
    console.error('Failed to submit batch job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit batch job' },
      { status: 500 }
    );
  }
};
