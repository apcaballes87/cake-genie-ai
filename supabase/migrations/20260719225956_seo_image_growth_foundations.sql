-- Build and strengthen the eight collection hubs prioritized by the July
-- 2026 Search Console and Bing audit. The first four are the initial release;
-- later-batch rows preserve an existing live state but remain candidates when new.
INSERT INTO public.cakegenie_collections (
  name,
  slug,
  tags,
  description,
  item_count,
  sample_image,
  collection_type,
  trend_source,
  trend_checked_at,
  published_at,
  is_indexable,
  publication_status,
  matched_design_count,
  parent_slug
)
VALUES
  (
    'Bento Cake',
    'bento-cake',
    ARRAY['bento cake', 'bento cake design', 'bento cake price cebu', 'mini cake', 'korean bento cake'],
    'Browse bento cake designs for birthdays, monthsaries, and small gifts in Cebu. Compare styles, open any design for instant starting-price context, and customize its message, colors, and size for Metro Cebu delivery or pickup.',
    613,
    NULL,
    'evergreen',
    'gsc-image-growth-2026-07',
    NOW(),
    NOW(),
    TRUE,
    'published',
    613,
    NULL
  ),
  (
    'KATSEYE Cake',
    'katseye-cake',
    ARRAY['katseye', 'katseye cake', 'katseye cake design', 'katseye birthday cake', 'katseye kpop cake'],
    'Explore KATSEYE cake designs inspired by the group''s music, colors, logos, and fan celebrations. Open a distinct design to customize its message, size, and finish, then check pricing and Metro Cebu ordering options.',
    50,
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/admin/search-analysis/00ff76667f0901ff.jpg',
    'music',
    'gsc-image-growth-2026-07',
    NOW(),
    NOW(),
    TRUE,
    'published',
    50,
    'kpop-cake'
  ),
  (
    'Kuromi Cake',
    'kuromi-cake',
    ARRAY['kuromi', 'kuromi cake', 'kuromi cake design', 'kuromi birthday cake', 'sanrio cake'],
    'Find Kuromi cake designs with black, purple, pink, bow, skull, and character details for Cebu birthdays. Compare real cake images, customize a design, and see starting-price and delivery options before ordering.',
    52,
    NULL,
    'character',
    'gsc-image-growth-2026-07',
    NOW(),
    NOW(),
    TRUE,
    'published',
    52,
    NULL
  ),
  (
    'Minecraft Cake',
    'minecraft-cake',
    ARRAY['minecraft', 'minecraft cake', 'minecraft cake design', 'minecraft birthday cake', 'creeper cake'],
    'Browse Minecraft cake designs with blocks, Creepers, Steve, tools, and pixel-style decorations. Each image opens to a distinct customizable cake page with pricing context and Metro Cebu delivery or pickup options.',
    83,
    NULL,
    'character',
    'gsc-image-growth-2026-07',
    NOW(),
    NOW(),
    TRUE,
    'published',
    83,
    NULL
  ),
  (
    'Graduation Cake',
    'graduation-cake',
    ARRAY['graduation', 'graduation cake', 'graduation cake design', 'graduation cake cebu', 'congratulations cake'],
    'Explore graduation cake designs for school, college, and university celebrations in Cebu. Compare caps, diplomas, school colors, and congratulatory messages, then customize a design and check starting prices.',
    117,
    NULL,
    'occasion',
    'gsc-image-growth-2026-07',
    NOW(),
    NULL,
    FALSE,
    'candidate',
    117,
    NULL
  ),
  (
    '18th Birthday & Debut Cake',
    'debut-cake',
    ARRAY['18th birthday cake', '18th birthday cake design', 'debut cake', 'debut cake cebu', 'eighteenth birthday cake'],
    'Browse 18th birthday and debut cake designs for Cebu celebrations, from elegant florals and bows to personalized milestone themes. Customize a distinct design, review starting-price context, and plan delivery or pickup.',
    163,
    NULL,
    'milestone',
    'gsc-image-growth-2026-07',
    NOW(),
    NULL,
    FALSE,
    'candidate',
    163,
    NULL
  ),
  (
    '30th Birthday Cake',
    '30th-birthday-cake',
    ARRAY['30th birthday cake', '30th birthday cake design', '30th cake', 'milestone cake', 'thirtieth birthday cake'],
    'Find 30th birthday cake designs for Cebu milestone celebrations, including elegant, funny, minimalist, and themed styles. Open any image to customize the message and details and see starting-price context.',
    66,
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/30th-birthday-pink-1-tier-cake-70df.webp',
    'milestone',
    'gsc-image-growth-2026-07',
    NOW(),
    NULL,
    FALSE,
    'candidate',
    66,
    NULL
  ),
  (
    '60th Birthday & Senior Cake',
    'senior-cake',
    ARRAY['60th birthday cake', '60th birthday cake design', 'senior cake', 'milestone cake', 'sixtieth birthday cake'],
    'Explore 60th birthday cake designs for Cebu milestone celebrations, from elegant floral and gold details to personalized family themes. Customize a design and review starting prices and delivery or pickup options.',
    91,
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/60th-birthday-white-1-tier-cake-feff.webp',
    'milestone',
    'gsc-image-growth-2026-07',
    NOW(),
    NULL,
    FALSE,
    'candidate',
    91,
    NULL
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tags = EXCLUDED.tags,
  description = EXCLUDED.description,
  item_count = GREATEST(COALESCE(cakegenie_collections.item_count, 0), EXCLUDED.item_count),
  sample_image = COALESCE(EXCLUDED.sample_image, cakegenie_collections.sample_image),
  collection_type = EXCLUDED.collection_type,
  trend_source = EXCLUDED.trend_source,
  trend_checked_at = EXCLUDED.trend_checked_at,
  published_at = CASE
    WHEN EXCLUDED.slug IN ('bento-cake', 'katseye-cake', 'kuromi-cake', 'minecraft-cake')
      THEN COALESCE(cakegenie_collections.published_at, EXCLUDED.published_at)
    ELSE cakegenie_collections.published_at
  END,
  is_indexable = CASE
    WHEN EXCLUDED.slug IN ('bento-cake', 'katseye-cake', 'kuromi-cake', 'minecraft-cake')
      THEN TRUE
    ELSE cakegenie_collections.is_indexable
  END,
  publication_status = CASE
    WHEN EXCLUDED.slug IN ('bento-cake', 'katseye-cake', 'kuromi-cake', 'minecraft-cake')
      THEN 'published'
    ELSE cakegenie_collections.publication_status
  END,
  matched_design_count = GREATEST(COALESCE(cakegenie_collections.matched_design_count, 0), EXCLUDED.matched_design_count),
  parent_slug = COALESCE(EXCLUDED.parent_slug, cakegenie_collections.parent_slug);

-- Consolidate bento informational intent into the stronger URL. The old row
-- stays in the database for history but is removed from public blog listings
-- and the blog sitemap; Next.js permanently redirects its public URL.
UPDATE public.blogs
SET
  title = 'Bento Cake Designs & Prices in Cebu (2026)',
  excerpt = 'See bento cake designs, sizes, and current starting-price guidance for Cebu. Compare popular styles, browse real cake images, and customize a bento cake for delivery or pickup.',
  image = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/blogs/bento-cakes/what-is-a-bento-cake.webp',
  keywords = 'bento cake design, bento cake price Cebu, bento cake size, Korean bento cake, mini cake Cebu',
  cake_search_keywords = 'bento cake, bento cake design, korean bento cake design',
  related_cakes_intro = 'Compare real bento cake designs, then open any image to customize it and check starting prices for Metro Cebu delivery or pickup.',
  design_showcases = '[{"id":"bento-gallery","keyword":"bento cake","title":"Bento Cake Design Gallery","intro":"Browse real bento cake designs available in Cebu. Open any image to customize the message, colors, and finish and check its starting price."}]'::jsonb,
  content = REPLACE(CASE
    WHEN POSITION('[[design_showcase:bento-gallery]]' IN content) > 0 THEN content
    ELSE REPLACE(
      content,
      '## Best bento cake messages for 2026',
      $bento$
## More bento cake design styles to compare

The best bento design depends on the recipient and the mood of the celebration. Beyond minimalist lettering and character cakes, Cebu buyers are also choosing coquette bows, vintage rosettes, gothic black-and-purple palettes, galaxy swirls, palette-knife florals, geometric graphics, and small luxury cakes with gold details. Seasonal messages and designs for him work well too, especially when the colors and text are personalized.

Use the gallery below to compare real examples. Each image opens to its own customizer page, where you can adjust the message, colors, finish, and size and review a starting price. For the full catalog, browse the [Bento Cake Designs collection](/collections/bento-cake).

[[design_showcase:bento-gallery]]

## Best bento cake messages for 2026$bento$
    )
  END, E'# Bento cake 2026: The ultimate guide to this adorable trend\n', E'## Bento cake 2026: The ultimate guide to this adorable trend\n'),
  is_published = TRUE,
  updated_at = NOW()
WHERE slug = 'bento-cake-guide-2026';

UPDATE public.blogs
SET
  is_published = FALSE,
  updated_at = NOW()
WHERE slug = 'bento-cake-designs-guide-every-style-2026';

-- Preserve the Jollibee article's winning URL, title, and H1 while improving
-- freshness, its commercial party-cake section, and the Cebu buyer path.
UPDATE public.blogs
SET
  excerpt = 'Official Jollibee vs McDonald''s party package prices for 2026 — kiddie party, group packages, and full menu inclusions compared. Updated July 2026, with Cebu party-cake planning tips.',
  related_cakes_intro = 'Planning a Jollibee, McDonald''s, or home party in Cebu? Compare kids'' party cake designs and open one to customize the theme, message, size, and starting price.',
  content = CASE
    WHEN POSITION('## Add the party cake to your Cebu budget' IN content) > 0 THEN content
    ELSE REPLACE(
      content,
      $jollibee_marker$---

*Need a custom cake$jollibee_marker$,
      $jollibee_section$## Add the party cake to your Cebu budget

Fast-food packages cover meals, venue time, and party activities, but the birthday cake is often a separate decision. Before booking, set aside a cake budget based on guest count, design complexity, and whether you need Metro Cebu delivery. Browse [kids' party cake designs in Cebu](/kids-party-cakes-cebu) to compare real themes and starting-price options without changing the package comparison above.

**Last reviewed:** July 20, 2026. Package availability and branch-level charges can change, so confirm the final quotation with the branch you plan to book.

---

*Need a custom cake$jollibee_section$
    )
  END,
  updated_at = NOW()
WHERE slug = 'jollibee-vs-mcdonalds-kids-party-packages-2026';

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.cakegenie_collections WHERE slug IN (
    'bento-cake', 'katseye-cake', 'kuromi-cake', 'minecraft-cake',
    'graduation-cake', 'debut-cake', '30th-birthday-cake', 'senior-cake'
  ) AND item_count >= 8) <> 8 THEN
    RAISE EXCEPTION 'SEO collection rollout did not build all eight priority hubs';
  END IF;

  IF (SELECT COUNT(*) FROM public.cakegenie_collections WHERE slug IN (
    'bento-cake', 'katseye-cake', 'kuromi-cake', 'minecraft-cake'
  ) AND publication_status = 'published' AND is_indexable = TRUE) <> 4 THEN
    RAISE EXCEPTION 'SEO collection rollout did not publish the first four hubs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.blogs
    WHERE slug = 'bento-cake-guide-2026'
      AND is_published = TRUE
      AND POSITION('[[design_showcase:bento-gallery]]' IN content) > 0
  ) THEN
    RAISE EXCEPTION 'Bento consolidation did not update the primary article';
  END IF;
END $$;
