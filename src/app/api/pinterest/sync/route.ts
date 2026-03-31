// src/app/api/pinterest/sync/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';
import { createClient } from '@supabase/supabase-js';
import { slugToTitle } from '@/lib/utils/pinterest';

export const dynamic = 'force-dynamic';

const SLEEP_MS = 10000; // 10 seconds between each pin for extra safety
const DAILY_LIMIT = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const { collectionName, accessToken: providedToken, pHashes } = await request.json();

    // Initialize Supabase client inside the handler to avoid build-time errors
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing for Pinterest manual sync:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      });
      return NextResponse.json({ 
        error: 'Supabase configuration error'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let accessToken = providedToken;

    // 0. If no token provided, try to use stored token (Automation bridge)
    if (!accessToken) {
      const { data: tokenRecord } = await supabase
        .from('cakegenie_pinterest_tokens')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!tokenRecord) {
        return NextResponse.json({ error: 'Missing accessToken and no stored tokens found' }, { status: 400 });
      }

      accessToken = tokenRecord.access_token;
      
      // Check expiry and refresh if needed
      const isExpired = new Date(tokenRecord.expires_at) <= new Date();
      if (isExpired) {
        console.log('Access token expired in manual sync, refreshing...');
        const clientId = process.env.PINTEREST_CLIENT_ID || process.env.NEXT_PUBLIC_PINTEREST_APP_ID;
        const clientSecret = process.env.PINTEREST_CLIENT_SECRET || process.env.PINTEREST_APP_SECRET;
        
        if (clientId && clientSecret) {
          const refreshed = await pinterestService.refreshToken(tokenRecord.refresh_token, clientId, clientSecret);
          accessToken = refreshed.access_token;
          
          const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
          await supabase
            .from('cakegenie_pinterest_tokens')
            .update({
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token,
              expires_at: expiresAt,
              updated_at: new Date().toISOString()
            })
            .eq('id', tokenRecord.id);
        }
      }
    }

    // 1. Check Daily Limit
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: pinsLast24Hours, error: countError } = await supabase
      .from('cakegenie_pinterest_pins')
      .select('*', { count: 'exact', head: true })
      .gt('pinned_at', twentyFourHoursAgo);

    if (countError) {
      return NextResponse.json({ error: 'Failed to check daily limit' }, { status: 500 });
    }

    if ((pinsLast24Hours || 0) >= DAILY_LIMIT) {
      return NextResponse.json({ 
        error: `Daily limit reached. You have already pinned ${pinsLast24Hours} items in the last 24 hours.` 
      }, { status: 429 });
    }

    const remainingPins = DAILY_LIMIT - (pinsLast24Hours || 0);
    const hashesToPin = pHashes?.slice(0, remainingPins) || [];

    if (hashesToPin.length === 0) {
      return NextResponse.json({ error: 'No products selected or remaining limit is zero' }, { status: 400 });
    }

    // 2. Fetch Products from Cache
    const { data: products, error: productsError } = await supabase
      .from('cakegenie_analysis_cache')
      .select('*')
      .in('p_hash', hashesToPin);

    if (productsError || !products) {
      return NextResponse.json({ error: 'Failed to fetch products from cache' }, { status: 500 });
    }

    // 3. Ensure Board
    const boardName = collectionName || 'Genie.ph - Best Cakes';
    const boardDescription = `Beautiful custom cakes curated by Genie.ph`;
    
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

    let pinsCreated = 0;
    const syncResults = [];

    // 4. Create Pins SEQUENTIALLY
    for (const product of products) {
      if (!product.original_image_url) continue;

      try {
        const pin = await pinterestService.createPin(accessToken, {
          board_id: boardId,
          title: slugToTitle(product.slug),
          description: product.seo_description || product.alt_text || `Order this beautiful custom cake on Genie.ph`,
          link: `https://genie.ph/customizing/${product.slug}`,
          alt_text: product.alt_text || 'Premium custom cake design',
          media_source: {
            source_type: 'image_url',
            url: product.original_image_url,
          },
        });
 
        // 5. Record the pin in our database
        await supabase.from('cakegenie_pinterest_pins').insert({
          p_hash: product.p_hash,
          pinterest_pin_id: pin.id,
          board_id: boardId,
        });

        pinsCreated++;
        syncResults.push({ p_hash: product.p_hash, status: 'success' });

        // Safety delay
        if (pinsCreated < products.length) {
          await sleep(SLEEP_MS);
        }
      } catch (pinErr: any) {
        console.error(`Failed to pin product ${product.p_hash}:`, pinErr.message);
        syncResults.push({ p_hash: product.p_hash, status: 'error', error: pinErr.message });
      }
    }

    return NextResponse.json({
      message: `Sync completed! Created ${pinsCreated} pins.`,
      used_limit: (pinsLast24Hours || 0) + pinsCreated,
      remaining: DAILY_LIMIT - ((pinsLast24Hours || 0) + pinsCreated),
      results: syncResults,
    });
  } catch (err: any) {
    console.error('Pinterest sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

