// src/app/api/pinterest/boards/sync/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get stored Pinterest token
    const { data: tokenRecord } = await supabase
      .from('cakegenie_pinterest_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Pinterest not connected. Please connect your account first.' }, { status: 401 });
    }

    let accessToken = tokenRecord.access_token;

    // Refresh token if expired
    const isExpired = new Date(tokenRecord.expires_at) <= new Date();
    if (isExpired) {
      const clientId = process.env.PINTEREST_CLIENT_ID;
      const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
      if (clientId && clientSecret) {
        const refreshed = await pinterestService.refreshToken(tokenRecord.refresh_token, clientId, clientSecret);
        accessToken = refreshed.access_token;
        await supabase
          .from('cakegenie_pinterest_tokens')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tokenRecord.id);
      }
    }

    // 2. Fetch all collections from DB
    const { data: collections, error: collectionsError } = await supabase
      .from('cakegenie_collections')
      .select('name, slug, description, item_count')
      .order('name', { ascending: true });

    if (collectionsError || !collections) {
      return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
    }

    // 3. Fetch existing Pinterest boards
    const boardsResponse = await pinterestService.listBoards(accessToken);
    const existingBoards = boardsResponse.items || [];
    const existingBoardNames = new Set(existingBoards.map((b) => b.name.toLowerCase()));

    // 4. Create boards for collections that don't have one yet
    const results: { collection: string; slug: string; status: 'created' | 'exists' | 'error'; board_id?: string; error?: string }[] = [];

    for (const collection of collections) {
      const boardName = collection.name;
      const boardDescription =
        collection.description ||
        `Custom ${collection.name.toLowerCase()} cakes from Genie.ph. Order yours today!`;

      if (existingBoardNames.has(boardName.toLowerCase())) {
        const existingBoard = existingBoards.find((b) => b.name.toLowerCase() === boardName.toLowerCase());
        results.push({ collection: boardName, slug: collection.slug, status: 'exists', board_id: existingBoard?.id });
        continue;
      }

      try {
        const newBoard = await pinterestService.createBoard(accessToken, boardName, boardDescription);
        results.push({ collection: boardName, slug: collection.slug, status: 'created', board_id: newBoard.id });
        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (err: any) {
        results.push({ collection: boardName, slug: collection.slug, status: 'error', error: err.message });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const existing = results.filter((r) => r.status === 'exists').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      message: `Done! ${created} boards created, ${existing} already existed, ${errors} errors.`,
      created,
      existing,
      errors,
      results,
    });
  } catch (err: any) {
    console.error('Board sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
