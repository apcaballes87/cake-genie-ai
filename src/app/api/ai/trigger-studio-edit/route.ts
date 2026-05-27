import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { runImageStudioJob } from '@/lib/admin/imageStudioJob';

type TriggerStudioEditRequestBody = {
  pHash?: string;
  originalImage?: {
    data?: string;
    mimeType?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TriggerStudioEditRequestBody;
    const pHash = typeof body?.pHash === 'string' ? body.pHash.trim() : '';
    const originalImage = body?.originalImage;
    const hasInlineOriginalImage = Boolean(originalImage?.data && originalImage?.mimeType);

    if (!pHash) {
      return NextResponse.json({ error: 'pHash is required' }, { status: 400 });
    }

    if (originalImage && !hasInlineOriginalImage) {
      return NextResponse.json(
        { error: 'originalImage must include both data and mimeType' },
        { status: 400 }
      );
    }

    // Use `after` to decouple the image synthesis so we don't block the UI
    after(async () => {
      console.log(`[Background] Triggering Image Studio for pHash: ${pHash}`, {
        mode: hasInlineOriginalImage ? 'inline-original-image' : 'cache-row',
      });
      try {
        const result = await runImageStudioJob({
          pHash,
          requestContext: request,
          inlineOriginalImage: hasInlineOriginalImage
            ? {
              data: originalImage!.data!,
              mimeType: originalImage!.mimeType!,
            }
            : null,
          requireExistingRow: !hasInlineOriginalImage,
          waitForCacheRow: hasInlineOriginalImage,
        });

        console.log(`[Background] Image Studio finished for ${pHash}.`, {
          persistedToCacheRow: result.persistedToCacheRow,
          storagePath: result.storagePath,
        });
      } catch (triggerError) {
        console.error(`[Background] Studio job failed for ${pHash}:`, triggerError);
      }
    });

    return NextResponse.json({ success: true, message: 'Studio edit triggered in background' });
  } catch (error) {
    console.error('Trigger error:', error);
    return NextResponse.json({ error: 'Failed to trigger edit' }, { status: 500 });
  }
}
