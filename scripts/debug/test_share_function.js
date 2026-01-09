// Test script for share-design Edge Function
// This simulates what the Edge Function does without needing to deploy it

const testShareFunction = async () => {
  // Mock data that would come from your database
  const mockDesignData = {
    title: "Test Cake Design",
    description: "A beautiful cake design created with Genie",
    customized_image_url: "https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp",
    url_slug: "test-cake-design-12345"
  };

  console.log("Testing share function with mock data:");
  console.log("Title:", mockDesignData.title);
  console.log("Description:", mockDesignData.description);
  console.log("Image URL:", mockDesignData.customized_image_url);
  console.log("Slug:", mockDesignData.url_slug);

  // Simulate the HTML that would be generated
  const APP_DOMAIN = 'http://localhost:5173'; // Your local dev server
  const canonicalUrl = `${APP_DOMAIN}/designs/${mockDesignData.url_slug}`;
  const clientRedirectUrl = `${APP_DOMAIN}/#/designs/${mockDesignData.url_slug}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${mockDesignData.title}</title>
      
      <!-- Open Graph / Facebook / Messenger -->
      <meta property="og:type" content="website">
      <meta property="og:url" content="${canonicalUrl}">
      <meta property="og:title" content="${mockDesignData.title}">
      <meta property="og:description" content="${mockDesignData.description}">
      <meta property="og:image" content="${mockDesignData.customized_image_url}">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
      
      <!-- Twitter -->
      <meta property="twitter:card" content="summary_large_image">
      <meta property="twitter:url" content="${canonicalUrl}">
      <meta property="twitter:title" content="${mockDesignData.title}">
      <meta property="twitter:description" content="${mockDesignData.description}">
      <meta property="twitter:image" content="${mockDesignData.customized_image_url}">
      
      <!-- JavaScript redirect for real users -->
      <script type="text/javascript">
        // In a real scenario, this would only run for real users, not bots
        // window.location.href = "${clientRedirectUrl}";
      </script>
    </head>
    <body>
      <h1>Redirecting you to the design...</h1>
      <p>If you are not redirected, <a href="${clientRedirectUrl}">click here</a>.</p>
    </body>
    </html>
  `;

  console.log("\nGenerated HTML with Open Graph tags:");
  console.log(html);
  
  return html;
};

// Run the test
testShareFunction().catch(console.error);