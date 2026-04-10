// src/app/api/pinterest/cron/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SLEEP_MS = 10000;
const DAILY_LIMIT = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: Request) {
  // 1. Security Check (Vercel Cron Secret or simple header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing for Pinterest cron:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      });
      return NextResponse.json({ 
        error: 'Supabase configuration error'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Get Persistent Tokens
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('cakegenie_pinterest_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: 'No Pinterest tokens found. Please connect Pinterest first.' }, { status: 400 });
    }

    let accessToken = tokenRecord.access_token;
    const isExpired = new Date(tokenRecord.expires_at) <= new Date();

    // 3. Refresh Token if needed
    if (isExpired) {
      console.log('Access token expired, refreshing...');
      const clientId = process.env.PINTEREST_CLIENT_ID || process.env.NEXT_PUBLIC_PINTEREST_APP_ID;
      const clientSecret = process.env.PINTEREST_CLIENT_SECRET || process.env.PINTEREST_APP_SECRET;

      if (!clientId || !clientSecret) {
        console.error('Pinterest credentials missing for refresh');
        throw new Error('Pinterest configuration error');
      }

      const refreshed = await pinterestService.refreshToken(tokenRecord.refresh_token, clientId, clientSecret);
      
      accessToken = refreshed.access_token;
      
      // Update DB with new tokens
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from('cakegenie_pinterest_tokens')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token, // Rotation might occur
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', tokenRecord.id);
    }

    // 4. Check Daily Limit (Last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: pinsLast24Hours } = await supabase
      .from('cakegenie_pinterest_pins')
      .select('*', { count: 'exact', head: true })
      .gt('pinned_at', twentyFourHoursAgo);

    if ((pinsLast24Hours || 0) >= DAILY_LIMIT) {
      return NextResponse.json({ message: 'Daily limit already reached' });
    }

    const remainingPins = DAILY_LIMIT - (pinsLast24Hours || 0);

    // 5. Select Products (Not yet pinned)
    // We select items from cache that are NOT in cakegenie_pinterest_pins
    const { data: pinnedHashes } = await supabase
      .from('cakegenie_pinterest_pins')
      .select('p_hash');
    
    const excludedHashes = pinnedHashes?.map(h => h.p_hash) || [];

    const query = supabase
      .from('cakegenie_analysis_cache')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(remainingPins);

    if (excludedHashes.length > 0) {
      query.not('p_hash', 'in', `(${excludedHashes.join(',')})`);
    }

    const { data: products, error: productsError } = await query;

    if (productsError || !products || products.length === 0) {
      return NextResponse.json({ message: 'No new products to pin' });
    }

    // 6. Ensure Board section/selection (Dynamic logic)
    const boardName = 'Genie.ph - Best Cakes';
    const boardDescription = 'Daily curated custom cakes by Genie.ph';
    
    let boardId: string | null = null;
    try {
      // First, try to find the board
      const boardsResponse = await pinterestService.listBoards(accessToken);
      const existingBoard = boardsResponse.items.find(b => b.name === boardName);
      
      if (existingBoard) {
        boardId = existingBoard.id;
      } else {
        const { board: newBoard } = await pinterestService.createBoard(accessToken, boardName, boardDescription);
        boardId = newBoard?.id ?? null;
      }
    } catch (e: any) {
      console.error('Board logic failed:', e.message);
      return NextResponse.json({ error: `Board logic failed: ${e.message}` }, { status: 500 });
    }

    if (!boardId) {
      return NextResponse.json({ error: 'Could not determine Pinterest board' }, { status: 500 });
    }

    // 7. Parallel Sync
    const productsToPin = products.filter(p => p.original_image_url);

    const pinPromises = productsToPin.map(async (product) => {
      try {
        const pin = await pinterestService.createPin(accessToken, {
          board_id: boardId!,
          title: product.slug?.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') || 'Custom Cake',
          description: product.seo_description || product.alt_text || `Order this beautiful custom cake on Genie.ph`,
          link: `https://genie.ph/customizing/${product.slug}`,
          alt_text: product.alt_text || 'Premium custom cake design',
          media_source: {
            source_type: 'image_url',
            url: product.original_image_url!,
          },
        });

        return {
          p_hash: product.p_hash,
          pinterest_pin_id: pin.id,
          board_id: boardId!,
          status: 'success' as const
        };
      } catch (pinErr: any) {
        console.error(`Failed to pin product ${product.p_hash}:`, pinErr.message);
        return {
          p_hash: product.p_hash,
          status: 'error' as const,
          error: pinErr.message
        };
      }
    });

    const results = await Promise.all(pinPromises);
    const successfulResults = results.filter(r => r.status === 'success');

    // Bulk Record the pins
    if (successfulResults.length > 0) {
      const pinsToInsert = successfulResults.map(r => ({
        p_hash: r.p_hash,
        pinterest_pin_id: (r as any).pinterest_pin_id,
        board_id: (r as any).board_id,
      }));

      try {
        // Optimistic Bulk Insert
        const { error: bulkError } = await supabase
          .from('cakegenie_pinterest_pins')
          .insert(pinsToInsert);

        if (bulkError) {
          console.warn('Bulk insert failed in cron, falling back to individual inserts:', bulkError.message);
          await Promise.all(pinsToInsert.map(pin =>
            supabase.from('cakegenie_pinterest_pins').insert(pin).catch(err => {
              console.error(`Failed to record pin ${pin.p_hash} individually in cron:`, err.message);
            })
          ));
        }
      } catch (err: any) {
        console.error('Error during bulk recording pins in cron:', err.message);
      }
    }

    const pinnedCount = successfulResults.length;
    const syncResults = results.map(r => ({
      p_hash: r.p_hash,
      status: r.status,
      ...(r.status === 'error' ? { error: (r as any).error } : {})
    }));

    return NextResponse.json({ 
      success: true, 
      pinned: pinnedCount,
      results: syncResults
    });
  } catch (err: any) {
    console.error('Cron sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
