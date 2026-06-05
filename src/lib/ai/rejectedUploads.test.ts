import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logRejectedUpload, REJECTED_UPLOADS_BUCKET } from './rejectedUploads';

const uploadMock = vi.fn();
const insertMock = vi.fn();

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: () => ({
    storage: {
      from: vi.fn((bucket: string) => {
        expect(bucket).toBe(REJECTED_UPLOADS_BUCKET);
        return { upload: uploadMock };
      }),
    },
    from: vi.fn((table: string) => {
      expect(table).toBe('cakegenie_rejected_uploads');
      return { insert: insertMock };
    }),
  }),
}));

vi.mock('@/lib/server/imageFingerprint', () => ({
  FINGERPRINT_PIPELINE: 'test-fingerprint-pipeline',
  computeImageFingerprint: vi.fn(async () => ({
    pHash: 'abc123def4567890',
    pipeline: 'test-fingerprint-pipeline',
  })),
}));

describe('logRejectedUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
  });

  it('stores rejected upload image metadata and rejection details privately', async () => {
    const imageData = Buffer.from('fake image bytes').toString('base64');
    const request = new Request('https://genie.ph/api/ai/analyze', {
      headers: {
        'user-agent': 'vitest',
        'x-forwarded-for': '203.0.113.7',
      },
    });

    await logRejectedUpload({
      imageData,
      mimeType: 'image/png',
      rejection: {
        isRejected: true,
        reason: 'not_a_cake',
        message: "This image doesn't appear to be a cake.",
      },
      modelName: 'gemini-test',
      promptVersion: '3.11',
      sourceRoute: 'api/ai/analyze',
      sourceContext: 'customizer-upload',
      request,
    });

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}\/\d+-[0-9a-f-]+\.png$/),
      expect.any(Uint8Array),
      { contentType: 'image/png', upsert: false },
    );

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      source_route: 'api/ai/analyze',
      source_context: 'customizer-upload',
      rejection_reason: 'not_a_cake',
      rejection_message: "This image doesn't appear to be a cake.",
      model_name: 'gemini-test',
      mime_type: 'image/png',
      image_size_bytes: 16,
      p_hash: 'abc123def4567890',
      fingerprint_pipeline: 'test-fingerprint-pipeline',
      storage_bucket: REJECTED_UPLOADS_BUCKET,
      prompt_version: '3.11',
      user_agent: 'vitest',
    }));

    const inserted = insertMock.mock.calls[0][0];
    expect(inserted.image_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted.client_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted.storage_path).toMatch(/\.png$/);
    expect(inserted.rejection_json).toEqual(expect.objectContaining({ isRejected: true }));
  });

  it('does nothing for accepted analysis results', async () => {
    await logRejectedUpload({
      imageData: Buffer.from('ok').toString('base64'),
      mimeType: 'image/png',
      rejection: { isRejected: false },
      modelName: 'gemini-test',
    });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('does not throw when persistence fails', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'storage down' } });
    insertMock.mockResolvedValue({ error: { message: 'db down' } });

    await expect(logRejectedUpload({
      imageData: Buffer.from('fake image bytes').toString('base64'),
      mimeType: 'image/png',
      rejection: { isRejected: true, reason: 'multiple_cakes' },
      modelName: 'gemini-test',
    })).resolves.toBeUndefined();

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      storage_bucket: null,
      storage_path: null,
      rejection_reason: 'multiple_cakes',
    }));
  });
});
