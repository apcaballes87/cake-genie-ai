update blogs
set
  design_showcases = jsonb_build_array(
    jsonb_build_object(
      'id', 'jollibee-party',
      'keyword', 'jollibee cake',
      'title', 'Jollibee Cake Design Showcase',
      'intro', 'If you are leaning toward a Jollibee party, these real Jollibee-inspired cake designs give you a quick visual starting point for the birthday cake.'
    ),
    jsonb_build_object(
      'id', 'mcdonalds-party',
      'keyword', 'mcdonalds cake',
      'title', 'McDonald''s Cake Design Showcase',
      'intro', 'If your child is more into McDonald''s themes, browse these McDonald''s-inspired cake designs you can customize for the celebration.'
    )
  ),
  content = replace(
    replace(
      content,
      '- **Website:** jollibee.com.ph',
      E'- **Website:** jollibee.com.ph\n\n[[design_showcase:jollibee-party]]'
    ),
    '- **Website:** mcdonalds.com.ph',
    E'- **Website:** mcdonalds.com.ph\n\n[[design_showcase:mcdonalds-party]]'
  ),
  updated_at = now()
where slug = 'jollibee-vs-mcdonalds-kids-party-packages-2026';

select
  slug,
  design_showcases,
  position('[[design_showcase:jollibee-party]]' in content) as jollibee_placeholder_pos,
  position('[[design_showcase:mcdonalds-party]]' in content) as mcdonalds_placeholder_pos,
  updated_at
from blogs
where slug = 'jollibee-vs-mcdonalds-kids-party-packages-2026';
