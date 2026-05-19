INSERT INTO public.cakegenie_collections (
    name,
    slug,
    description,
    tags,
    sample_image,
    item_count
)
VALUES (
    'Pickleball Cake',
    'pickleball-cake',
    'Serve up a winning celebration with a Pickleball cake. Featuring paddles, court lines, neon green balls, and sporty details, this theme is perfect for birthdays, tournaments, and surprise parties for pickleball lovers.',
    ARRAY[
        'Pickleball Cake',
        'pickleball',
        'pickleball cake',
        'pickleball birthday cake',
        'pickleball themed cake',
        'paddle sports',
        'sports cake'
    ],
    'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/customizations/pickleball-white-1-tier-cake-c1c1.webp',
    (
        SELECT COUNT(*)
        FROM public.cakegenie_analysis_cache
        WHERE original_image_url IS NOT NULL
          AND slug IS NOT NULL
          AND (
              keywords ILIKE '%pickleball%'
              OR alt_text ILIKE '%pickleball%'
              OR slug ILIKE '%pickleball%'
          )
    )
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tags = EXCLUDED.tags,
    sample_image = EXCLUDED.sample_image,
    item_count = EXCLUDED.item_count;
