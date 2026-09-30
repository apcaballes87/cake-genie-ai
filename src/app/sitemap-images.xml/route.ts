import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSitemapInventory } from "@/lib/sitemap/indexability";
import { isPublicHttpImageUrl } from "@/lib/seo/crawlerImage";
import { isPublishedIndexableCollection } from "@/lib/seo/collectionEligibility";

export const dynamic = "force-dynamic";

/**
 * Sanitize a URL for XML sitemap output.
 * Strips query params from Supabase storage URLs and XML-escapes all others.
 */
const sanitizeUrl = (url: string | null | undefined): string => {
  if (!isPublicHttpImageUrl(url)) return "";
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname.includes("supabase")) {
      return escapeXml(`${parsed.origin}${parsed.pathname}`);
    }
    return escapeXml(url.trim());
  } catch {
    return "";
  }
};

/** Escape all XML special characters */
const escapeXml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

type ProductImageSitemapRow = {
  slug: string | null;
  image_url: string | null;
  merchant: { slug: string; is_active: boolean } | { slug: string; is_active: boolean }[] | null;
};

type BlogImageSitemapRow = {
  slug: string | null;
  image: string | null;
};

type CollectionImageSitemapRow = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  sample_image: string | null;
  item_count: number;
  publication_status: string;
  is_indexable: boolean;
};

const PRIORITY_IMAGE_COLLECTIONS = new Set([
  "bento-cake",
  "katseye-cake",
  "kuromi-cake",
  "minecraft-cake",
  "graduation-cake",
  "debut-cake",
  "30th-birthday-cake",
  "senior-cake",
]);

const GENERIC_COLLECTION_TERMS = new Set([
  "cake",
  "cakes",
  "custom cake",
  "birthday",
  "birthday cake",
  "cebu",
  "genie.ph",
]);

function getMerchantSlug(
  value: ProductImageSitemapRow["merchant"],
): string | null {
  if (Array.isArray(value)) {
    return value[0]?.is_active ? value[0].slug : null;
  }

  return value?.is_active ? value.slug : null;
}

export async function GET() {
  try {
    return await buildImageSitemapResponse();
  } catch (error) {
    console.error("Failed to build image sitemap", error);
    return new NextResponse("Image sitemap temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

async function buildImageSitemapResponse() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const baseUrl = "https://genie.ph";
  const { customizedCakes: allItems, sharedDesigns } = await getSitemapInventory();

  // --- Customizing entries ---
  const customizingEntries = allItems
    .map((item) => {
      const imageLoc = sanitizeUrl(item.image_url);
      if (!imageLoc) return "";

      return `  <url>
    <loc>${baseUrl}/customizing/${escapeXml(item.slug)}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
    </image:image>
  </url>`;
    })
    .filter(Boolean);

  const sharedDesignEntries = sharedDesigns
    .map((design) => {
      const imageLoc = sanitizeUrl(design.image_url);
      if (!imageLoc) return "";
      return `  <url>
    <loc>${baseUrl}/customizing/${escapeXml(design.url_slug)}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
    </image:image>
  </url>`;
    })
    .filter(Boolean);

  // --- Product entries ---
  // Products need merchant slug from the merchants table (joined via merchant_id)
  const BATCH_SIZE = 1000;
  const productItems: ProductImageSitemapRow[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("cakegenie_merchant_products")
      .select(
        "slug, image_url, merchant:cakegenie_merchants!merchant_id!inner(slug,is_active)",
      )
      .eq("is_active", true)
      .eq("merchant.is_active", true)
      .not("image_url", "is", null)
      .range(offset, offset + BATCH_SIZE - 1)
      .returns<ProductImageSitemapRow[]>();

    if (error) throw new Error(`Failed to fetch product images: ${error.message}`);

    const batch = data || [];
    productItems.push(...batch);
    hasMore = batch.length === BATCH_SIZE;
    offset += BATCH_SIZE;
  }

  const productEntries = productItems
    .map((item) => {
      const imageLoc = sanitizeUrl(item.image_url);
      const merchantSlug = getMerchantSlug(item.merchant);
      if (!imageLoc || !merchantSlug || !item.slug) return "";

      return `  <url>
    <loc>${baseUrl}/shop/${escapeXml(merchantSlug)}/${escapeXml(item.slug)}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
    </image:image>
  </url>`;
    })
    .filter(Boolean);

  // --- Blog entries ---
  const { data: blogPosts, error: blogError } = await supabase
    .from("blogs")
    .select("slug, image")
    .not("image", "is", null)
    .eq("is_published", true)
    .returns<BlogImageSitemapRow[]>();

  if (blogError) throw new Error(`Failed to fetch blog images: ${blogError.message}`);

  const blogEntries = (blogPosts || [])
    .map((post) => {
      const imageLoc = sanitizeUrl(post.image);
      if (!imageLoc || !post.slug) return "";

      return `  <url>
    <loc>${baseUrl}/blog/${escapeXml(post.slug)}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
    </image:image>
  </url>`;
    })
    .filter(Boolean);

  // --- Collection entries ---
  // Each collection page gets its top design images in the image sitemap
  const { data: collections, error: collectionsError } = await supabase
    .from("cakegenie_collections")
    .select("slug, name, description, tags, sample_image, item_count, publication_status, is_indexable")
    .eq("publication_status", "published")
    .eq("is_indexable", true)
    .gte("item_count", 8)
    .returns<CollectionImageSitemapRow[]>();

  if (collectionsError) throw new Error(`Failed to fetch collection images: ${collectionsError.message}`);

  const collectionEntries: string[] = [];
  if (collections && collections.length > 0) {
    // Build a map of collection images from the already-fetched analysis cache
    // Group designs by their tags to find images for each collection
    // Pre-compute lowercase keywords for all items to avoid redundant work in the loop
    const processedItems = allItems.map((item) => ({
      item,
      searchKw: (item.keywords || "").toLowerCase(),
    }));

    for (const col of collections.filter(isPublishedIndexableCollection)) {
      const colName = (col.name || col.slug || "")
        .toLowerCase()
        .replace(/-/g, " ");
      const colSlugName = (col.slug || "").replace(/-/g, " ");
      const collectionTerms = [
        colName,
        colSlugName,
        ...(col.tags || []).map((tag) => tag.toLowerCase()),
      ].filter((term) => term.length >= 3 && !GENERIC_COLLECTION_TERMS.has(term));
      const imageLimit = PRIORITY_IMAGE_COLLECTIONS.has(col.slug) ? 12 : 5;

      // Find public images that match this collection's slug, name, or curated tags.
      const matchingDesigns = [];
      for (let i = 0; i < processedItems.length; i++) {
        const { item, searchKw } = processedItems[i];
        if (collectionTerms.some((term) => searchKw.includes(term))) {
          matchingDesigns.push(item);
          if (matchingDesigns.length >= imageLimit) break;
        }
      }

      if (matchingDesigns.length === 0) continue;

      const imageEntries = matchingDesigns
        .map((item) => {
          const imageLoc = sanitizeUrl(item.image_url);
          if (!imageLoc) return "";
          return `    <image:image>
      <image:loc>${imageLoc}</image:loc>
    </image:image>`;
        })
        .filter(Boolean);

      if (imageEntries.length > 0) {
        collectionEntries.push(`  <url>
    <loc>${baseUrl}/collections/${escapeXml(col.slug)}</loc>
${imageEntries.join("\n")}
  </url>`);
      }
    }
  }

  const entries = [
    ...customizingEntries,
    ...sharedDesignEntries,
    ...productEntries,
    ...blogEntries,
    ...collectionEntries,
  ].join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control":
        "public, max-age=1800, s-maxage=1800, stale-while-revalidate=43200",
    },
  });
}
