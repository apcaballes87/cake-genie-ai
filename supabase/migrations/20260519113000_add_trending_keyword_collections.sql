-- Add trending keyword-driven collections discovered from current PH search demand
WITH collection_seed(name, slug, description, tags) AS (
  VALUES
    (
      'Bento Cake',
      'bento-cake',
      'Keep it compact, cute, and giftable with a Bento cake. Usually packed with minimalist piping, heartfelt messages, Korean-inspired styling, and lunchbox-sized charm, this collection is perfect for quick surprises, monthsaries, office gifting, and intimate celebrations.',
      ARRAY['Bento Cake', 'bento cake', 'bento cakes', 'korean bento cake', 'minimalist bento cake', 'lunchbox cake', 'small cake']::text[]
    ),
    (
      'Roblox Cake',
      'roblox-cake',
      'Level up the party with a Roblox cake. Featuring blocky avatars, game icons, bright colors, and custom character references, this gaming theme is a huge hit for kids who want their favorite virtual world turned into a real birthday centerpiece.',
      ARRAY['Roblox Cake', 'roblox cake', 'roblox birthday cake', 'gaming cake', 'roblox theme cake', 'roblox design cake']::text[]
    ),
    (
      'Spiderman Cake',
      'spiderman-cake',
      'Swing into action with a Spiderman cake. Styled with web patterns, city skylines, masks, and bold red-and-blue superhero energy, this collection is perfect for Marvel-loving kids who want a dramatic and instantly recognizable birthday cake.',
      ARRAY['Spiderman Cake', 'spiderman cake', 'spider-man cake', 'spiderman birthday cake', 'marvel cake', 'superhero cake']::text[]
    ),
    (
      'Safari Cake',
      'safari-cake',
      'Bring the wild outdoors to the table with a Safari cake. Filled with jungle animals, leafy textures, earthy tones, and adventure details, this theme is especially popular for 1st birthdays, baby showers, and nature-inspired kids parties.',
      ARRAY['Safari Cake', 'safari cake', 'jungle safari cake', 'animal cake', 'wild one cake', 'zoo cake', 'jungle animals']::text[]
    ),
    (
      'Stitch Cake',
      'stitch-cake',
      'Add a playful island vibe with a Stitch cake. Featuring the lovable blue alien, tropical colors, hibiscus accents, and chaotic-cute energy, this collection is perfect for Disney fans, kids birthdays, and fun pastel celebrations.',
      ARRAY['Stitch Cake', 'stitch cake', 'lilo and stitch cake', 'disney stitch cake', 'blue alien cake', 'hawaiian cake']::text[]
    ),
    (
      'Sonic Cake',
      'sonic-cake',
      'Speed into celebration with a Sonic cake. Packed with racing motion, rings, checkerboard details, and the iconic blue hedgehog, this collection is a strong pick for video game fans who want a fast, energetic birthday theme.',
      ARRAY['Sonic Cake', 'sonic cake', 'sonic the hedgehog cake', 'gaming cake', 'video game cake', 'sonic birthday cake']::text[]
    ),
    (
      'Space Cake',
      'space-cake',
      'Launch the party into orbit with a Space cake. Decorated with stars, rockets, planets, moons, and galaxy textures, this collection is ideal for kids who love astronauts, science themes, and dreamy outer-space birthdays.',
      ARRAY['Space Cake', 'space cake', 'outer space cake', 'galaxy cake', 'astronaut cake', 'rocket cake', 'planet cake']::text[]
    ),
    (
      'Sanrio Cake',
      'sanrio-cake',
      'Wrap the celebration in kawaii charm with a Sanrio cake. This umbrella theme brings together Hello Kitty, Kuromi, My Melody, Cinnamoroll, Pompompurin, and other cute favorites for pastel, character-filled cakes that are wildly popular with kids, teens, and collectors.',
      ARRAY['Sanrio Cake', 'sanrio cake', 'hello kitty and friends cake', 'kawaii cake', 'kuromi cake', 'my melody cake', 'cinnamoroll cake']::text[]
    ),
    (
      'Tinkerbell Cake',
      'tinkerbell-cake',
      'Sprinkle pixie dust on the celebration with a Tinkerbell cake. Featuring fairy wings, sparkles, flowers, and enchanted forest styling, this whimsical theme is a lovely fit for little girls who want a magical birthday cake.',
      ARRAY['Tinkerbell Cake', 'tinkerbell cake', 'fairy cake', 'pixie dust cake', 'disney fairy cake', 'enchanted cake']::text[]
    ),
    (
      'Super Mario Cake',
      'super-mario-cake',
      'Power up the birthday table with a Super Mario cake. Expect question blocks, mushrooms, pipes, stars, and favorite characters from the Mushroom Kingdom, making this collection a classic gaming theme for kids and nostalgic adults alike.',
      ARRAY['Super Mario Cake', 'super mario cake', 'mario cake', 'mario bros cake', 'nintendo cake', 'gaming cake']::text[]
    ),
    (
      'Lambeth Cake',
      'lambeth-cake',
      'Go full vintage glam with a Lambeth cake. Known for dramatic overpiping, ornate borders, pearls, swags, and romantic old-school elegance, this collection is perfect for trendy birthdays, bridal showers, and statement celebrations.',
      ARRAY['Lambeth Cake', 'lambeth cake', 'vintage cake', 'overpiped cake', 'retro cake', 'romantic cake', 'ornate piping']::text[]
    ),
    (
      'Wild One Cake',
      'wild-one-cake',
      'Celebrate a little adventurer with a Wild One cake. Blending safari animals, boho neutrals, greenery, and 1st birthday styling, this collection is especially strong for baby boys and girls turning one.',
      ARRAY['Wild One Cake', 'wild one cake', '1st birthday cake', 'first birthday cake', 'safari first birthday', 'boho birthday cake']::text[]
    ),
    (
      'Burn Away Cake',
      'burn-away-cake',
      'Reveal the surprise with a Burn Away cake. Designed with a top edible sheet that is safely burned to uncover a hidden message, image, or second design underneath, this collection fits funny reveals, couples surprises, and social-media-ready custom orders.',
      ARRAY['Burn Away Cake', 'burn away cake', 'burnaway cake', 'reveal cake', 'hidden message cake', 'surprise cake']::text[]
    )
)
INSERT INTO public.cakegenie_collections (
  name,
  slug,
  description,
  tags,
  sample_image,
  item_count
)
SELECT
  c.name,
  c.slug,
  c.description,
  c.tags,
  (
    SELECT ac.original_image_url
    FROM public.cakegenie_analysis_cache ac
    WHERE ac.original_image_url IS NOT NULL
      AND ac.original_image_url <> ''
      AND ac.slug IS NOT NULL
      AND (
        ac.slug ILIKE '%' || c.slug || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(c.tags) AS tag
          WHERE ac.keywords ILIKE '%' || tag || '%'
             OR ac.alt_text ILIKE '%' || tag || '%'
             OR ac.slug ILIKE '%' || replace(lower(tag), ' ', '-') || '%'
        )
      )
    ORDER BY ac.usage_count DESC NULLS LAST, ac.created_at DESC NULLS LAST
    LIMIT 1
  ) AS sample_image,
  (
    SELECT COUNT(*)
    FROM public.cakegenie_analysis_cache ac
    WHERE ac.original_image_url IS NOT NULL
      AND ac.original_image_url <> ''
      AND ac.slug IS NOT NULL
      AND (
        ac.slug ILIKE '%' || c.slug || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(c.tags) AS tag
          WHERE ac.keywords ILIKE '%' || tag || '%'
             OR ac.alt_text ILIKE '%' || tag || '%'
             OR ac.slug ILIKE '%' || replace(lower(tag), ' ', '-') || '%'
        )
      )
  ) AS item_count
FROM collection_seed c
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  sample_image = EXCLUDED.sample_image,
  item_count = EXCLUDED.item_count;
