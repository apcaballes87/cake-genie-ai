-- Seed the initial researched trend collection queue.
-- These rows start as non-indexable stocking opportunities. Run the admin
-- search-analysis intake for the recommended queries, then run
-- scripts/update-collections-studio-images.ts to promote rows that reach the
-- eight-design publication gate.
INSERT INTO public.cakegenie_collections (
  name,
  slug,
  tags,
  description,
  collection_type,
  trend_source,
  trend_score,
  trend_checked_at,
  publication_status,
  is_indexable,
  parent_slug
)
VALUES
  (
    'KATSEYE Cake',
    'katseye-cake',
    ARRAY['katseye', 'katseye cake', 'katseye birthday cake', 'katseye kpop cake'],
    'Browse KATSEYE cake designs for birthdays, fan celebrations, and music-themed surprises in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'music', 'initial-web-research-2026-06-02', 100, NOW(), 'stocking', FALSE, 'kpop-cake'
  ),
  (
    'Stray Kids Cake',
    'stray-kids-cake',
    ARRAY['stray kids', 'stray kids cake', 'skz cake', 'stray kids birthday cake'],
    'Browse Stray Kids cake designs for birthdays, fan celebrations, and K-pop surprises in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'music', 'initial-web-research-2026-06-02', 95, NOW(), 'stocking', FALSE, 'kpop-cake'
  ),
  (
    'TWICE Cake',
    'twice-cake',
    ARRAY['twice', 'twice cake', 'twice birthday cake', 'once kpop cake'],
    'Browse TWICE cake designs for birthdays, fan celebrations, and K-pop surprises in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'music', 'initial-web-research-2026-06-02', 92, NOW(), 'stocking', FALSE, 'kpop-cake'
  ),
  (
    'ENHYPEN Cake',
    'enhypen-cake',
    ARRAY['enhypen', 'enhypen cake', 'enhypen birthday cake', 'engene cake'],
    'Browse ENHYPEN cake designs for birthdays, fan celebrations, and K-pop surprises in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'music', 'initial-web-research-2026-06-02', 90, NOW(), 'stocking', FALSE, 'kpop-cake'
  ),
  (
    'Aespa Cake',
    'aespa-cake',
    ARRAY['aespa', 'aespa cake', 'aespa birthday cake', 'aespa kpop cake'],
    'Browse aespa cake designs for birthdays, fan celebrations, and K-pop surprises in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'music', 'initial-web-research-2026-06-02', 88, NOW(), 'stocking', FALSE, 'kpop-cake'
  ),
  (
    'Jellycat Cake',
    'jellycat-cake',
    ARRAY['jellycat', 'jellycat cake', 'jellycat birthday cake', 'jellycat plush cake'],
    'Browse Jellycat cake designs for birthdays, gifting moments, and plush-collector celebrations in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'toy', 'initial-web-research-2026-06-02', 96, NOW(), 'stocking', FALSE, NULL
  ),
  (
    'Baby Three Cake',
    'baby-three-cake',
    ARRAY['baby three', 'baby three cake', 'baby three birthday cake', 'baby three blind box cake'],
    'Browse Baby Three cake designs for birthdays, gifting moments, and blind-box collector celebrations in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'toy', 'initial-web-research-2026-06-02', 82, NOW(), 'stocking', FALSE, NULL
  ),
  (
    'Crybaby Cake',
    'crybaby-cake',
    ARRAY['crybaby', 'crybaby cake', 'crybaby pop mart cake', 'crybaby birthday cake'],
    'Browse Crybaby cake designs for birthdays, gifting moments, and Pop Mart collector celebrations in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'toy', 'initial-web-research-2026-06-02', 80, NOW(), 'stocking', FALSE, NULL
  ),
  (
    'Twinkle Twinkle Cake',
    'twinkle-twinkle-cake',
    ARRAY['twinkle twinkle', 'twinkle twinkle cake', 'twinkle twinkle pop mart cake'],
    'Browse Twinkle Twinkle cake designs for birthdays, gifting moments, and Pop Mart collector celebrations in Cebu. Choose a real design, personalize the size and message, then check instant pricing and available Metro Cebu delivery or pickup options.',
    'toy', 'initial-web-research-2026-06-02', 76, NOW(), 'stocking', FALSE, NULL
  )
ON CONFLICT (slug) DO UPDATE SET
  tags = EXCLUDED.tags,
  description = EXCLUDED.description,
  collection_type = EXCLUDED.collection_type,
  trend_source = EXCLUDED.trend_source,
  trend_score = EXCLUDED.trend_score,
  trend_checked_at = EXCLUDED.trend_checked_at,
  parent_slug = EXCLUDED.parent_slug;
