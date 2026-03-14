// src/app/api/pinterest/sync/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SLEEP_MS = 10000; // 10 seconds between each pin for extra safety
const DAILY_LIMIT = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const { collectionName, accessToken, pHashes } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }

    // Initialize Supabase client inside the handler to avoid build-time errors
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // 3. Create Board (mapped to collection)
    const boardName = collectionName || 'Genie.ph - Best Cakes';
    const boardDescription = `Beautiful custom cakes curated by Genie.ph`;
    
    // Pinterest API doesn't have an "upsert" board, so we just try to create it.
    // In a mature version, we'd list boards first and match by name.
    let board;
    try {
      board = await pinterestService.createBoard(accessToken, boardName, boardDescription);
    } catch (boardErr: any) {
      // If board already exists, we might get an error. 
      // For now, if it fails, we assume it's because it exists or other reasons and try to proceed if we have a board ID or handle error
      console.error('Board creation error (may already exist):', boardErr.message);
      // Fallback: we should actually search for the board ID if creation fails
      // For simplicity in this refinement, we'll assume creation works or we'd need to add getBoards to service.
      throw new Error(`Could not ensure board "${boardName}" exists: ${boardErr.message}`);
    }

    let pinsCreated = 0;
    const syncResults = [];

    // 4. Create Pins SEQUENTIALLY
    for (const product of products) {
      if (!product.original_image_url) continue;

      try {
        const pin = await pinterestService.createPin(accessToken, {
          board_id: board.id,
          title: product.slug?.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') || 'Custom Cake',
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
          board_id: board.id,
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

