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
        .select('title, description, customized_image_url, url_slug')
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

    // 3. Check if this is a bot or a real user
    const userAgent = req.headers.get('user-agent') || '';
    const isBot = /bot|crawler|spider|facebook|twitter|whatsapp|linkedin|slack|messenger/i.test(userAgent);

    const APP_DOMAIN = 'https://genie.ph';
    const canonicalUrl = `${APP_DOMAIN}/designs/${slug}`; // The URL crawlers see
    const clientRedirectUrl = `${APP_DOMAIN}/#/designs/${slug}`; // The SPA route for users

    // If it's a real user (not a bot), redirect them immediately
    if (!isBot) {
        return new Response(null, {
            status: 302,
            headers: {
                'Location': clientRedirectUrl,
                ...corsHeaders
            }
        });
    }

    const title = escapeHtml(data.title || "Check out this Cake Design!");
    const description = escapeHtml(data.description || "I created this custom cake design using Genie. What do you think?");
    
    // Ensure the image URL is properly formatted for social media previews
    let imageUrl = data.customized_image_url;
    if (imageUrl) {
        // If it's a base64 data URI, we can't use it for social media previews
        // In this case, we should use a default image or try to get a proper URL
        if (imageUrl.startsWith('data:')) {
            // Use a default image for social media previews
            imageUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp';
        } 
        // If it's not already a full URL, construct it properly
        else if (!imageUrl.startsWith('http')) {
            imageUrl = `https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/${imageUrl}`;
        }
    } else {
        // Fallback to default image if no image URL is available
        imageUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp';
    }

    // Enhanced Open Graph meta tags for better Messenger compatibility
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        
        <!-- Primary Meta Tags -->
        <meta name="title" content="${title}">
        <meta name="description" content="${description}">
        
        <!-- Open Graph / Facebook / Messenger -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${canonicalUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${imageUrl}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:image:type" content="image/png">
        <meta property="og:site_name" content="Genie">
        
        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="${canonicalUrl}">
        <meta property="twitter:title" content="${title}">
        <meta property="twitter:description" content="${description}">
        <meta property="twitter:image" content="${imageUrl}">
        
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
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            // Allow inline scripts for the JavaScript redirect
            'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"
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