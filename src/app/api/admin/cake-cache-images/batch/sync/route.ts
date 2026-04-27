import { NextRequest, NextResponse } from 'next/server';
import { createPublicServerSupabaseClient } from '@/lib/supabase/publicServer';
import { getAI, getAIClientDiagnostics } from '@/lib/ai/client';
import { ADMIN_IMAGE_STUDIO_PIN, getImageStudioStoragePath, getImageStudioOutputDimensions } from '@/lib/admin/imageStudio';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import readline from 'readline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const STORAGE_BUCKET = 'cakegenie';

const isAuthorized = (req: NextRequest) => {
  return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
};

const finalizeEditedImage = async (
  buffer: Buffer,
  dimensions?: { width: number; height: number; wasUpscaled: boolean } | null
) => {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = dimensions?.width ?? metadata.width ?? 1200;
  const height = dimensions?.height ?? metadata.height ?? 1200;

  const resizedImage =
    dimensions?.wasUpscaled && metadata.width && metadata.height
      ? image.resize(width, height, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      : image;

  const enhancedImage = dimensions?.wasUpscaled
    ? resizedImage.sharpen(0.8, 1, 2)
    : resizedImage;

  return enhancedImage
    .webp({
      quality: dimensions?.wasUpscaled ? 96 : 92,
      effort: 6,
    })
    .toBuffer();
};

export const GET = async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createPublicServerSupabaseClient();
  const aiClient = getAI(req);
  const diagnostics = getAIClientDiagnostics(req);

  if (diagnostics.mode === 'vertex') {
    return NextResponse.json(
      { error: 'Batch jobs are currently configured for AI Studio only.' },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch pending batch jobs
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('cakegenie_image_studio_batch_jobs')
      .select('*')
      .eq('status', 'pending');

    if (jobsError) {
      throw new Error(`Failed to fetch pending jobs: ${jobsError.message}`);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({ message: 'No pending batch jobs found.' });
    }

    const processedJobs = [];

    // 2. Process each job
    for (const job of pendingJobs) {
      try {
        const batchJob = await aiClient.batches.get({ name: job.gemini_job_name });
        
        // Types in the SDK represent state with JOB_STATE_ prefix
        if (batchJob.state === 'JOB_STATE_SUCCEEDED' || batchJob.state === 'JOB_STATE_PARTIALLY_SUCCEEDED' || batchJob.state === 'JOB_STATE_FAILED' || batchJob.state === 'JOB_STATE_CANCELLED') {
            
          let finalStatus = batchJob.state === 'JOB_STATE_SUCCEEDED' ? 'completed' : 
                            batchJob.state === 'JOB_STATE_PARTIALLY_SUCCEEDED' ? 'completed_with_errors' : 'failed';

          const destFileName = batchJob.dest?.fileName;
          const outputFilePath = path.join(os.tmpdir(), `batch_output_${job.id}_${Date.now()}.jsonl`);

          if (destFileName) {
            // Download the file
            await aiClient.files.download({
              file: destFileName,
              downloadPath: outputFilePath
            });

            // Parse JSONL
            const fileStream = fs.createReadStream(outputFilePath);
            const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

            for await (const line of rl) {
              if (!line.trim()) continue;
              
              const record = JSON.parse(line);
              // Each line represents a response. 
              // The original custom id should be in `record.id` or we map it somehow.
              // Wait, the documentation says input key matches output key. 
              // Wait, standard `@google/genai` JSONL output format for batch responses:
              // {"id": "...", "response": { ... }} OR {"key": "...", "response": ...}
              // Let's check both possibilities.
              const requestId = record.id || record.key || record.customId;
              const response = record.response;

              if (requestId && response) {
                // Fetch the original row to get original dimensions
                const { data: cacheRow } = await supabase
                  .from('cakegenie_analysis_cache')
                  .select('*')
                  .eq('p_hash', requestId)
                  .single();

                if (cacheRow) {
                  const candidate = response?.candidates?.[0];
                  const partsResponse = candidate?.content?.parts;
                  const imagePart = partsResponse?.find((part: any) => part.inlineData?.data);

                  if (imagePart?.inlineData?.data) {
                    const generatedBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
                    const generatedMetadata = await sharp(generatedBuffer).metadata();
                    
                    const outputDimensions = getImageStudioOutputDimensions(
                      cacheRow.image_width ?? generatedMetadata.width ?? null,
                      cacheRow.image_height ?? generatedMetadata.height ?? null
                    );
                    
                    const watermarkedBuffer = await finalizeEditedImage(
                      generatedBuffer,
                      outputDimensions
                    );
                    
                    const storagePath = getImageStudioStoragePath({
                      slug: cacheRow.slug,
                      pHash: requestId,
                    });

                    const { error: uploadError } = await supabase.storage
                      .from(STORAGE_BUCKET)
                      .upload(storagePath, watermarkedBuffer, {
                        contentType: 'image/webp',
                        upsert: true,
                      });

                    if (!uploadError) {
                      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
                      
                      await supabase
                        .from('cakegenie_analysis_cache')
                        .update({
                          studio_edited_image_url: publicUrl,
                          studio_edit_status: 'completed',
                          studio_edit_error: null,
                          studio_edited_at: new Date().toISOString(),
                        })
                        .eq('p_hash', requestId);
                    } else {
                      await supabase
                        .from('cakegenie_analysis_cache')
                        .update({
                          studio_edit_status: 'failed',
                          studio_edit_error: `Upload Error: ${uploadError.message}`,
                        })
                        .eq('p_hash', requestId);
                    }
                  } else {
                      await supabase
                        .from('cakegenie_analysis_cache')
                        .update({
                          studio_edit_status: 'failed',
                          studio_edit_error: 'No image data returned from batch job for this item.',
                        })
                        .eq('p_hash', requestId);
                  }
                }
              }
            }
            
            // Clean up downloaded JSONL
            fs.unlinkSync(outputFilePath);
          } else {
             // Mark all related images as failed if there was no output file and it wasn't successful
             if (finalStatus !== 'completed') {
                await supabase
                 .from('cakegenie_analysis_cache')
                 .update({
                   studio_edit_status: 'failed',
                   studio_edit_error: `Batch Job Failed or Cancelled: ${batchJob.state}`,
                 })
                 .eq('batch_job_id', job.id);
             }
          }

          // Update job status
          await supabase
            .from('cakegenie_image_studio_batch_jobs')
            .update({
              status: finalStatus,
              output_file_uri: destFileName || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);

          processedJobs.push({ id: job.id, status: finalStatus });

          // Try to delete the input file if possible
          if (job.input_file_uri) {
              try {
                  await aiClient.files.delete({ name: job.input_file_uri });
              } catch (e) {
                  console.warn(`Could not delete input file ${job.input_file_uri}`, e);
              }
          }
          if (destFileName) {
              try {
                  await aiClient.files.delete({ name: destFileName });
              } catch (e) {
                  console.warn(`Could not delete output file ${destFileName}`, e);
              }
          }
        }
      } catch (err: any) {
        console.error(`Failed to process batch job ${job.id}:`, err);
        processedJobs.push({ id: job.id, error: err.message });
      }
    }

    return NextResponse.json({ 
        message: 'Sync completed.', 
        processedJobs
    });

  } catch (error: any) {
    console.error('Failed to sync batch jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync batch jobs' },
      { status: 500 }
    );
  }
};
