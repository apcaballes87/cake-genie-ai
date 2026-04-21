import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';

export async function POST(request: NextRequest) {
  try {
    const { pHash } = await request.json();

    if (!pHash) {
      return NextResponse.json({ error: 'pHash is required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    // Use `after` to decouple the image synthesis so we don't block the UI
    after(async () => {
      console.log(`[Background] Triggering Image Studio for pHash: ${pHash}`);
      try {
        const adminResponse = await fetch(`${baseUrl}/api/admin/cake-cache-images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-pin': ADMIN_IMAGE_STUDIO_PIN,
          },
          body: JSON.stringify({ pHash }),
        });
        
        if (!adminResponse.ok) {
          const body = await adminResponse.text();
          console.error(`[Background] Error from Image Studio. Status: ${adminResponse.status}. Body: ${body}`);
        } else {
          console.log(`[Background] Triggered successfully for ${pHash}.`);
        }
      } catch (triggerError) {
        console.error(`[Background] Fetch failed:`, triggerError);
      }
    });

    return NextResponse.json({ success: true, message: 'Studio edit triggered in background' });
  } catch (error) {
    console.error('Trigger error:', error);
    return NextResponse.json({ error: 'Failed to trigger edit' }, { status: 500 });
  }
}
