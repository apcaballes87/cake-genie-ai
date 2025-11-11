// supabase/functions/generate-sitemap/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not set.');
    }

    // Use anon key for public access
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch all shared designs
    console.log('[generate-sitemap] Starting to fetch designs...');
    const { data: designs, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('url_slug, created_at')
      .order('created_at', { ascending: false });

    console.log('[generate-sitemap] Query completed');
    console.log('[generate-sitemap] Designs data:', designs);
    console.log('[generate-sitemap] Error:', error);

    if (error) {
      console.error('[generate-sitemap] Database error:', JSON.stringify(error, null, 2));
    }

    const designCount = designs?.length || 0;
    console.log('[generate-sitemap] Total designs to include:', designCount);

    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Static pages
    const staticPages = [
      { loc: 'https://genie.ph/', changefreq: 'weekly', priority: '1.0', lastmod: now },
      { loc: 'https://genie.ph/#/about', changefreq: 'monthly', priority: '0.8', lastmod: now },
      { loc: 'https://genie.ph/#/how-to-order', changefreq: 'monthly', priority: '0.7', lastmod: now },
      { loc: 'https://genie.ph/#/contact', changefreq: 'yearly', priority: '0.6', lastmod: now },
      { loc: 'https://genie.ph/#/reviews', changefreq: 'weekly', priority: '0.7', lastmod: now },
    ];

    // Build XML sitemap
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    for (const page of staticPages) {
      xml += `
  <url>
    <loc>${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${page.lastmod}</lastmod>
  </url>`;
    }

    // Add dynamic shared design pages
    if (designs && designs.length > 0) {
      for (const design of designs) {
        const lastmod = design.created_at 
          ? new Date(design.created_at).toISOString().split('T')[0]
          : now;
        
        xml += `
  <url>
    <loc>https://genie.ph/designs/${design.url_slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${lastmod}</lastmod>
  </url>`;
      }
    }

    xml += `
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400', // Cache for 1 hour (browser), 24 hours (CDN)
      },
      status: 200,
    });

  } catch (error) {
    console.error('[generate-sitemap] Critical error:', error);
    
    // Return a basic sitemap on error
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://genie.ph/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(fallbackXml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache on error
      },
      status: 200,
    });
  }
})
