import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

// Helper to escape HTML characters
const escapeHtml = (unsafe: string | null | undefined): string => {
  if (unsafe === null || unsafe === undefined) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. Get Environment Variables ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not set.');
    }
    
    // --- 2. Extract Design ID from URL ---
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const designId = pathParts[pathParts.length - 1];
    
    if (!designId) {
      throw new Error('Design ID not found in URL.');
    }

    // --- 3. Fetch Design Data from Supabase ---
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check if designId is a UUID or a URL slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(designId);

    const { data: design, error } = await supabaseAdmin
      .from('cakegenie_shared_designs')
      .select('*')
      .eq(isUuid ? 'design_id' : 'url_slug', designId)
      .single();

    if (error || !design) {
      // Return a simple 404 page
      const notFoundHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Design Not Found</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h1>404 - Design Not Found</h1>
            <p>This cake design doesn't exist or has been removed.</p>
          </body>
        </html>`;
      return new Response(notFoundHtml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        status: 404
      });
    }

    // --- 4. Construct the HTML Response with Meta Tags ---
    const pageTitle = escapeHtml(design.title || `Custom Cake Design by Genie`);
    const pageDescription = escapeHtml(design.description || `A custom cake design from Genie. Customize it yourself!`);
    const imageUrl = design.customized_image_url;
    // The canonical URL should be the one the bot is visiting
    const canonicalUrl = `https://genie.ph/share/${design.design_id}`; 
    // The URL for human users to be redirected to
    const clientAppUrl = `https://genie.ph/#/design/${design.design_id}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${pageTitle}</title>
          
          <!-- SEO / General Meta -->
          <meta name="description" content="${pageDescription}">
          <link rel="canonical" href="${canonicalUrl}">

          <!-- Open Graph / Facebook -->
          <meta property="og:type" content="website">
          <meta property="og:url" content="${canonicalUrl}">
          <meta property="og:title" content="${pageTitle}">
          <meta property="og:description" content="${pageDescription}">
          <meta property="og:image" content="${imageUrl}">
          <meta property="og:image:width" content="1024">
          <meta property="og:image:height" content="1024">

          <!-- Twitter -->
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:url" content="${canonicalUrl}">
          <meta name="twitter:title" content="${pageTitle}">
          <meta name="twitter:description" content="${pageDescription}">
          <meta name="twitter:image" content="${imageUrl}">

          <!-- Client-side redirect for human users -->
          <script>
            window.location.replace("${clientAppUrl}");
          </script>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h1>${pageTitle}</h1>
          <img src="${imageUrl}" alt="${escapeHtml(design.alt_text)}" style="max-width: 90%; width: 500px; height: auto; border-radius: 12px; margin: 20px auto;">
          <p>${pageDescription}</p>
          <p>If you are not redirected, <a href="${clientAppUrl}">click here</a>.</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
