// supabase/functions/share-design/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: any;

// Helper to escape HTML characters
const escapeHtml = (unsafe: string | null | undefined): string => {
  if (unsafe === null || unsafe === undefined) {
    return '';
  }
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

serve(async (req) => {
  // This is a browser-based request, so we should allow OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase environment variables are not set.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    // 1. Get the slug from the URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    // Example path: /functions/v1/share-design/my-awesome-cake-12345678
    // We want the last part.
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
        throw new Error("Design slug not found in URL.");
    }
    
    console.log(`[share-design] Received request for slug: ${slug}`);

    // 2. Fetch the design from Supabase
    const { data, error } = await supabaseAdmin
        .from('cakegenie_shared_designs')
        .select('title, description, alt_text, customized_image_url, url_slug')
        .eq('url_slug', slug)
        .single();
    
    if (error || !data) {
        if (error) console.error("[share-design] Supabase error:", error);
        return new Response("Design not found", {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
    }

    console.log(`[share-design] Found design: ${data.title}`);
    
    // 3. Construct the HTML with meta tags
    const APP_DOMAIN = 'https://genie.ph';
    const canonicalUrl = `${APP_DOMAIN}/designs/${slug}`; // The URL crawlers see
    const clientRedirectUrl = `${APP_DOMAIN}/#/designs/${slug}`; // The SPA route for users

    const title = escapeHtml(data.title || "Check out this Cake Design!");
    const description = escapeHtml(data.description || "I created this custom cake design using Genie. What do you think?");
    // Use alt_text if available, otherwise fall back to title, then generic text
    const altText = data.alt_text ? escapeHtml(data.alt_text) : (data.title ? escapeHtml(data.title) : "Custom cake design");
    const imageUrl = data.customized_image_url;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        
        <!-- Open Graph / Facebook / Messenger -->
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="Genie">
        <meta property="og:url" content="${canonicalUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${imageUrl}">
        <meta property="og:image:secure_url" content="${imageUrl}">
        <meta property="og:image:type" content="image/jpeg">
        <meta property="og:image:alt" content="${altText}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="fb:app_id" content="966242223397117">

        <!-- Twitter -->
        <meta name="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="${canonicalUrl}">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="${description}">
        <meta name="twitter:image" content="${imageUrl}">
        <meta name="twitter:image:alt" content="${altText}">
        
        <!-- JavaScript redirect for real users -->
        <script type="text/javascript">
          window.location.href = "${clientRedirectUrl}";
        </script>
      </head>
      <body>
        <h1>Redirecting you to the design...</h1>
        <p>If you are not redirected, <a href="${clientRedirectUrl}">click here</a>.</p>
      </body>
      </html>
    `;
    
    return new Response(html, {
        headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/html',
            // Cache for 1 hour in browser, 24 hours on CDN (like Vercel)
            // This drastically reduces Supabase load from bots.
            'Cache-Control': 'public, max-age=3600, s-maxage=86400'
        },
        status: 200,
    });

  } catch (error) {
    console.error('[share-design] Critical error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})