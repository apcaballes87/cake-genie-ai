import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

serve(async (req) => {
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not set.');
    }

    // Create Supabase client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all shared designs
    const { data: designs, error } = await supabaseAdmin
      .from('cakegenie_shared_designs')
      .select('design_id, url_slug, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching designs:', error);
      throw error;
    }

    // Generate sitemap XML
    const baseUrl = 'https://genie.ph';
    const urls = [
      // Static pages
      {
        loc: baseUrl,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '1.0'
      },
      // Dynamic design pages
      ...(designs || []).map(design => ({
        loc: `${baseUrl}/designs/${design.url_slug || design.design_id}`,
        lastmod: (design.updated_at || design.created_at)?.split('T')[0] || new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.8'
      }))
    ];

    // Build XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      status: 200
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://genie.ph</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`, {
      headers: {
        'Content-Type': 'application/xml',
      },
      status: 200
    });
  }
});
