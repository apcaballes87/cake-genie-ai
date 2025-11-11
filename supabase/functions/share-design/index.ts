// supabase/functions/share-design/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
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

// Helper to detect if the request is from a bot
const isBot = (userAgent: string): boolean => {
  const botPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'Slackbot',
    'TelegramBot',
    'WhatsApp',
    'Discordbot',
    'GoogleBot',
    'bingbot',
    'Baiduspider',
    'DuckDuckBot',
    'YandexBot',
    'Applebot',
    'bot',
    'crawler',
    'spider',
    'scraper'
  ];

  const ua = userAgent.toLowerCase();
  return botPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
};

serve(async (req) => {
  // This is a browser-based request, so we should allow OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables are not set.');
    }

    // Use anon key for public access to shared designs
    const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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

    // Check if this is a bot request
    const userAgent = req.headers.get('user-agent') || '';
    const isBotRequest = isBot(userAgent);
    console.log(`[share-design] User-Agent: ${userAgent}, isBot: ${isBotRequest}`);

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

    // 3. Define URLs
    const APP_DOMAIN = 'https://genie.ph';
    const canonicalUrl = `${APP_DOMAIN}/designs/${slug}`; // The URL crawlers see
    const clientRedirectUrl = `${APP_DOMAIN}/#/designs/${slug}`; // The SPA route for users

    // 4. If this is a human browser, do an immediate HTTP redirect
    if (!isBotRequest) {
        console.log(`[share-design] Redirecting human user to: ${clientRedirectUrl}`);
        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                'Location': clientRedirectUrl,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    }

    // 5. For bots, serve HTML with Open Graph tags
    console.log(`[share-design] Serving OG tags for bot`);
    const title = escapeHtml(data.title || "Check out this Cake Design!");
    const description = escapeHtml(data.description || "I created this custom cake design using Genie. What do you think?");
    // Use alt_text if available, otherwise fall back to title, then generic text
    const altText = data.alt_text ? escapeHtml(data.alt_text) : (data.title ? escapeHtml(data.title) : "Custom cake design");
    const imageUrl = data.customized_image_url;

    // Create structured data for SEO
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": data.title || "Custom Cake Design",
      "description": data.description || "Custom cake design created with Genie",
      "image": imageUrl,
      "url": canonicalUrl,
      "brand": {
        "@type": "Brand",
        "name": "Genie"
      },
      "offers": {
        "@type": "Offer",
        "availability": "https://schema.org/InStock",
        "url": canonicalUrl
      }
    };

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        
        <!-- Primary Meta Tags -->
        <title>${title} | Genie - Custom Cake Design</title>
        <meta name="title" content="${title}">
        <meta name="description" content="${description}">
        <meta name="keywords" content="custom cake design, cake customization, cake design tool, ${escapeHtml(data.title || 'cake')}">
        <meta name="author" content="Genie">
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="${canonicalUrl}">

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
        <meta property="og:locale" content="en_US">
        <meta property="fb:app_id" content="966242223397117">

        <!-- Twitter -->
        <meta name="twitter:card" content="summary_large_image">
        <meta property="twitter:domain" content="genie.ph">
        <meta property="twitter:url" content="${canonicalUrl}">
        <meta name="twitter:title" content="${title}">
        <meta name="twitter:description" content="${description}">
        <meta name="twitter:image" content="${imageUrl}">
        <meta name="twitter:image:alt" content="${altText}">

        <!-- Structured Data -->
        <script type="application/ld+json">
        ${JSON.stringify(structuredData)}
        </script>

        <!-- Preconnect for performance -->
        <link rel="preconnect" href="https://genie.ph">
        <link rel="dns-prefetch" href="https://genie.ph">

        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          h1 {
            font-size: 2em;
            margin-bottom: 0.5em;
            color: #1a1a1a;
          }
          .description {
            font-size: 1.1em;
            margin-bottom: 1.5em;
            color: #666;
          }
          .cake-image {
            width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 1.5em;
          }
          .cta-button {
            display: inline-block;
            background: #ff6b6b;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: background 0.3s;
          }
          .cta-button:hover {
            background: #ff5252;
          }
          footer {
            margin-top: 3em;
            padding-top: 2em;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 0.9em;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <main>
          <article itemscope itemtype="https://schema.org/Product">
            <h1 itemprop="name">${title}</h1>
            <p class="description" itemprop="description">${description}</p>
            <img 
              src="${imageUrl}" 
              alt="${altText}" 
              class="cake-image"
              itemprop="image"
              loading="eager"
            >
            <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <meta itemprop="availability" content="https://schema.org/InStock">
              <meta itemprop="url" content="${canonicalUrl}">
            </div>
            <p>
              <a href="${clientRedirectUrl}" class="cta-button">
                🎂 Customize This Design on Genie
              </a>
            </p>
          </article>
        </main>
        <footer>
          <p>
            Powered by <strong>Genie</strong> - The Ultimate Cake Customization Tool<br>
            <a href="https://genie.ph">Create Your Own Custom Cake Design</a>
          </p>
        </footer>
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