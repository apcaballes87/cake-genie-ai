// src/app/api/pinterest/sync/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';
import { getMerchantById, getMerchantProducts } from '@/services/supabaseService';
import { CakeGenieMerchantProduct } from '@/lib/database.types';

const SLEEP_MS = 5000; // 5 seconds between each pin

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const { merchantId, accessToken, productIds } = await request.json();

    if (!merchantId || !accessToken) {
      return NextResponse.json({ error: 'Missing merchantId or accessToken' }, { status: 400 });
    }

    // 1. Get Merchant Info
    const { data: merchant, error: merchantError } = await getMerchantById(merchantId);
    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // 2. Get Products (Filtered if productIds provided)
    const { data: allProducts, error: productsError } = await getMerchantProducts(merchantId);
    if (productsError || !allProducts) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const products = productIds 
      ? allProducts.filter(p => productIds.includes(p.product_id))
      : allProducts;

    if (products.length === 0) {
      return NextResponse.json({ message: 'No active products to sync' });
    }

    // 3. Create/Group by Board
    const boardName = `Genie.ph Cakes - ${merchant.business_name}`;
    const boardDescription = `Curated cake collections from ${merchant.business_name} at Genie.ph`;
    
    // In a real app, we'd check if the board exists, but for now we'll rely on service logic
    const board = await pinterestService.createBoard(accessToken, boardName, boardDescription);

    // 4. Group products by category (Collections)
    const productsByCategory = products.reduce((acc, product) => {
      const category = product.category || 'Special Cakes';
      if (!acc[category]) acc[category] = [];
      acc[category].push(product);
      return acc;
    }, {} as Record<string, CakeGenieMerchantProduct[]>);

    const syncResults = [];

    // 5. Create Sections and Pins SEQUENTIALLY with delays
    for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
      // Create section for this "collection" (Pinterest calls them sections)
      const section = await pinterestService.createSection(accessToken, board.id, category);
      
      let pinsCreated = 0;
      
      for (const product of categoryProducts) {
        if (!product.image_url) continue;

        try {
          await pinterestService.createPin(accessToken, {
            board_id: board.id,
            board_section_id: section.id,
            title: product.title,
            description: product.short_description || product.long_description || `Order ${product.title} from ${merchant.business_name} on Genie.ph`,
            link: `https://genie.ph/shop/${merchant.slug}/${product.slug}`,
            media_source: {
              source_type: 'image_url',
              url: product.image_url,
            },
          });
          
          pinsCreated++;
          
          // SAFETY DELAY: Mimic human behavior
          if (pinsCreated < categoryProducts.length) {
            await sleep(SLEEP_MS); 
          }
        } catch (pinErr: any) {
          console.error(`Failed to pin product ${product.product_id}:`, pinErr.message);
        }
      }

      syncResults.push({
        category,
        pins_created: pinsCreated,
      });

      // Extra delay between categories
      await sleep(SLEEP_MS * 2);
    }

    return NextResponse.json({
      message: `Sync completed! Created ${syncResults.reduce((sum, r) => sum + r.pins_created, 0)} pins safely across ${syncResults.length} categories.`,
      board_id: board.id,
      results: syncResults,
    });
  } catch (err: any) {
    console.error('Pinterest sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

