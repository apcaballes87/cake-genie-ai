import { createHash, randomUUID } from 'crypto';
import { computeImageFingerprint, FINGERPRINT_PIPELINE } from '@/lib/server/imageFingerprint';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const REJECTED_UPLOADS_BUCKET = 'cakegenie-rejected-uploads';

interface RejectionLogInput {
  imageData: string;
  mimeType: string;
  rejection: {
    isRejected?: boolean;
    reason?: string;
    message?: string;
    [key: string]: unknown;
  };
  modelName: string;
  promptVersion?: string | number | null;
  sourceRoute?: string;
  sourceContext?: string | null;
  request?: Request;
  metadata?: Record<string, unknown>;
}

function getClientIp(request?: Request): string | null {
  if (!request) return null;
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    null
  );
}

function hashClientIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.REJECTED_UPLOAD_IP_HASH_SALT?.trim() || '';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

export async function logRejectedUpload(input: RejectionLogInput): Promise<void> {
  if (!input.rejection?.isRejected) return;

  try {
    const admin = createAdminServerSupabaseClient();
    const imageBuffer = Buffer.from(input.imageData, 'base64');
    const imageSha256 = createHash('sha256').update(imageBuffer).digest('hex');
    const createdAt = new Date();
    const extension = extensionForMimeType(input.mimeType);
    const storagePath = `${createdAt.toISOString().slice(0, 10)}/${createdAt.getTime()}-${randomUUID()}.${extension}`;

    let pHash: string | null = null;
    let fingerprintPipeline: string | null = FINGERPRINT_PIPELINE;

    try {
      const fingerprint = await computeImageFingerprint(imageBuffer);
      pHash = fingerprint.pHash;
      fingerprintPipeline = fingerprint.pipeline;
    } catch (fingerprintError) {
      fingerprintPipeline = null;
      console.warn('[RejectedUploadLog] Fingerprint failed:', fingerprintError);
    }

    const { error: uploadError } = await admin.storage
      .from(REJECTED_UPLOADS_BUCKET)
      .upload(storagePath, Uint8Array.from(imageBuffer), {
        contentType: input.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.warn('[RejectedUploadLog] Storage upload failed:', uploadError.message);
    }

    const { error: insertError } = await admin.from('cakegenie_rejected_uploads').insert({
      source_route: input.sourceRoute ?? 'api/ai/analyze',
      source_context: input.sourceContext ?? null,
      rejection_reason: input.rejection.reason ?? null,
      rejection_message: input.rejection.message ?? null,
      rejection_json: input.rejection,
      model_name: input.modelName,
      mime_type: input.mimeType,
      image_size_bytes: imageBuffer.byteLength,
      image_sha256: imageSha256,
      p_hash: pHash,
      fingerprint_pipeline: fingerprintPipeline,
      storage_bucket: uploadError ? null : REJECTED_UPLOADS_BUCKET,
      storage_path: uploadError ? null : storagePath,
      prompt_version: input.promptVersion == null ? null : String(input.promptVersion),
      user_agent: input.request?.headers.get('user-agent') ?? null,
      client_ip_hash: hashClientIp(getClientIp(input.request)),
      metadata: input.metadata ?? {},
    });

    if (insertError) {
      console.warn('[RejectedUploadLog] Database insert failed:', insertError.message);
    }
  } catch (error) {
    console.warn('[RejectedUploadLog] Best-effort logging failed:', error);
  }
}
