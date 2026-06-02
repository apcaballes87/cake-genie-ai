-- Add high-intent visual merchandising collections. These are Cebu-wide
-- storefronts, not location-cloned pages.
-- Run scripts/update-collections-studio-images.ts after applying this migration
-- so sample_image prefers verified studio_edited_image_url cache values.
INSERT INTO public.cakegenie_collections (name, slug, tags, description)
VALUES
  (
    'Pink Cakes',
    'pink-cakes',
    ARRAY['pink', 'pink cake', 'pink cakes', 'pink birthday cake', 'pink custom cake', 'blush pink cake', 'pastel pink cake'],
    'Browse pink cake designs for birthdays, debuts, anniversaries, and thoughtful surprises. Personalize the shade, cake size, message, and decorative details, then choose delivery or pickup options available in Metro Cebu.'
  ),
  (
    'Black Cakes',
    'black-cakes',
    ARRAY['black', 'black cake', 'black cakes', 'black birthday cake', 'black custom cake', 'black and gold cake', 'elegant black cake'],
    'Explore black cake designs for adult birthdays, anniversaries, and polished milestone events. Adjust the size, message, accent colors, and decorative details, with delivery or pickup options available across Metro Cebu.'
  ),
  (
    'Emerald Green Cakes',
    'emerald-green-cakes',
    ARRAY['emerald green', 'emerald green cake', 'emerald cake', 'green cake', 'jewel tone cake', 'emerald and gold cake'],
    'Discover emerald green cakes for sophisticated birthdays, anniversaries, and formal celebrations. Personalize the size, message, finish, and gold or floral accents, then arrange delivery or pickup in Metro Cebu.'
  ),
  (
    'Sage Green Cakes',
    'sage-green-cakes',
    ARRAY['sage green', 'sage green cake', 'sage cake', 'green cake', 'botanical cake', 'boho cake', 'minimalist green cake'],
    'Browse sage green cakes with a calm, refined look for birthdays, weddings, showers, and intimate celebrations. Customize the size, message, botanical accents, and complementary colors, with Metro Cebu delivery or pickup options.'
  ),
  (
    'Coquette Cakes',
    'coquette-cakes',
    ARRAY['coquette', 'coquette cake', 'coquette cakes', 'bow cake', 'ribbon cake', 'ruffle cake', 'vintage bow cake', 'romantic cake'],
    'Explore coquette cakes styled with bows, ribbons, ruffles, pearls, and soft vintage details. Personalize the color palette, message, size, and decorative accents, then choose available delivery or pickup options in Metro Cebu.'
  ),
  (
    'Korean Minimalist Cakes',
    'korean-minimalist-cakes',
    ARRAY['korean minimalist', 'korean minimalist cake', 'korean cake', 'minimalist cake', 'korean style cake', 'simple cake', 'message cake'],
    'Find Korean minimalist cakes with smooth icing, soft colors, delicate piping, and simple personalized messages. Choose your preferred size, color, and wording, then check delivery or pickup options available in Metro Cebu.'
  ),
  (
    'Chrome Metallic Cakes',
    'chrome-metallic-cakes',
    ARRAY['chrome metallic', 'chrome cake', 'metallic cake', 'silver cake', 'gold cake', 'mirror cake', 'metallic finish cake'],
    'Browse chrome and metallic cake designs for modern birthdays, debuts, and statement celebrations. Customize the cake size, message, accent colors, and silver or gold details, with Metro Cebu delivery or pickup options.'
  ),
  (
    'Heart Cakes',
    'heart-cakes',
    ARRAY['heart', 'heart cake', 'heart cakes', 'heart shaped cake', 'vintage heart cake', 'romantic cake', 'anniversary heart cake'],
    'Explore heart cakes for birthdays, anniversaries, monthsaries, and meaningful surprises. Personalize the color, message, size, and piping style, then select delivery or pickup options available in Metro Cebu.'
  ),
  (
    'First Birthday Cakes',
    'first-birthday-cakes',
    ARRAY['first birthday', 'first birthday cake', '1st birthday cake', 'one year old cake', 'baby first birthday cake', 'smash cake', 'wild one cake'],
    'Browse first birthday cakes for a baby''s special milestone, from gentle pastel themes to playful character and safari designs. Customize the size, colors, name, and birthday message, with Metro Cebu delivery or pickup options.'
  ),
  (
    'Cakes for Boyfriend or Husband',
    'cakes-for-boyfriend-or-husband',
    ARRAY['boyfriend or husband', 'cake for boyfriend', 'cake for husband', 'boyfriend birthday cake', 'husband birthday cake', 'romantic cake', 'anniversary cake', 'monthsary cake'],
    'Find thoughtful cakes for a boyfriend or husband, whether you are celebrating a birthday, anniversary, monthsary, or simple surprise. Personalize the cake size, colors, message, and style, then choose available Metro Cebu delivery or pickup options.'
  ),
  (
    'Black Minimalist Cakes',
    'black-minimalist-cakes',
    ARRAY['black minimalist', 'black minimalist cake', 'minimalist black cake', 'black cake', 'minimalist cake', 'elegant black cake'],
    'Browse black minimalist cakes with clean lines, polished piping, and a modern monochrome finish. Personalize the size, message, and accent details, then choose available Metro Cebu delivery or pickup options.'
  ),
  (
    'Pink Vintage Cakes',
    'pink-vintage-cakes',
    ARRAY['pink vintage', 'pink vintage cake', 'vintage pink cake', 'pink cake', 'vintage cake', 'lambeth cake', 'ruffle cake'],
    'Explore pink vintage cakes with romantic piping, ruffles, bows, and soft statement details. Customize the message, size, and shade, then arrange available Metro Cebu delivery or pickup options.'
  ),
  (
    'Red Candy Cakes',
    'red-candy-cakes',
    ARRAY['red candy', 'red candy cake', 'candy cake', 'red cake', 'sweet cake', 'candyland cake'],
    'Discover red candy cakes with bright confectionery details, playful toppings, and a bold celebration-ready palette. Customize the size, message, and accents, then check Metro Cebu delivery or pickup options.'
  ),
  (
    'Sage Green Minimalist Cakes',
    'sage-green-minimalist-cakes',
    ARRAY['sage green minimalist', 'sage green minimalist cake', 'minimalist green cake', 'sage green cake', 'minimalist cake', 'botanical cake'],
    'Browse sage green minimalist cakes with soft botanical color, clean styling, and understated details. Personalize the size, message, and accents, then choose available Metro Cebu delivery or pickup options.'
  ),
  (
    'Black and Gold Cakes',
    'black-and-gold-cakes',
    ARRAY['black and gold', 'black and gold cake', 'black gold cake', 'black cake', 'gold cake', 'elegant cake'],
    'Explore black and gold cakes for polished birthdays, anniversaries, and milestone celebrations. Customize the size, message, and metallic accents, then choose available Metro Cebu delivery or pickup options.'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tags = EXCLUDED.tags,
  description = EXCLUDED.description;
