import { NextResponse } from 'next/server';

import { loadBusinessProfile } from '@/lib/chatbot/knowledge';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await loadBusinessProfile(createAdminServerSupabaseClient());
    return NextResponse.json(profile, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Business profile is unavailable.' }, { status: 503 });
  }
}
