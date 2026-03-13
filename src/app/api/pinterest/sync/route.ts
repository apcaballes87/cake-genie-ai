// src/app/api/pinterest/sync/route.ts
import { NextResponse } from 'next/server';
import { pinterestService } from '@/lib/services/pinterest';
import { getMerchantById, getMerchantProducts } from '@/services/supabaseService';
import { CakeGenieMerchantProduct } from '@/lib/database.types';

export async function POST(request: Request) {
  try {
    const { merchantId, accessToken } = await request.json();

    if (!merchantId || !accessToken) {
      return NextResponse.json({ error: 'Missing merchantId or accessToken' }, { status: 400 });
    }

    // 1. Get Merchant Info
    const { data: merchant, error: merchantError } = await getMerchantById(merchantId);
    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // 2. Get All Active Products
    const { data: products, error: productsError } = await getMerchantProducts(merchantId);
    if (productsError || !products) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    if (products.length === 0) {
      return NextResponse.json({ message: 'No active products to sync' });
    }

    // 3. Create/Group by Board
    const boardName = `Genie.ph Cakes - ${merchant.business_name}`;
    const board = await pinterestService.createBoard(accessToken, boardName, `Curated cake collections from ${merchant.business_name} at Genie.ph`);

    // 4. Group products by category (Collections)
    const productsByCategory = products.reduce((acc, product) => {
      const category = product.category || 'Special Cakes';
      if (!acc[category]) acc[category] = [];
      acc[category].push(product);
      return acc;
    }, {} as Record<string, CakeGenieMerchantProduct[]>);

    const syncResults = [];

    // 5. Create Sections and Pins
    for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
      // Create section for this "collection"
      const section = await pinterestService.createSection(accessToken, board.id, category);
      
      const pinPromises = categoryProducts.map(async (product) => {
        if (!product.image_url) return null;
        
        try {
          return await pinterestService.createPin(accessToken, {
            board_id: board.id,
            board_section_id: section.id,
            title: product.title,
            description: product.short_description || product.long_description || undefined,
            link: `https://genie.ph/shop/${merchant.slug}/${product.slug}`,
            media_source: {
              source_type: 'image_url',
              url: product.image_url,
            },
          });
        } catch (pinErr) {
          console.error(`Failed to pin product ${product.product_id}:`, pinErr);
          return null;
        }
      });

      const sectionPins = await Promise.all(pinPromises);
      syncResults.push({
        category,
        pins_created: sectionPins.filter(p => p !== null).length,
      });
    }

    return NextResponse.json({
      message: 'Sync completed successfully!',
      board_id: board.id,
      results: syncResults,
    });
  } catch (err: any) {
    console.error('Pinterest sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
