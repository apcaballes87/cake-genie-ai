-- ============================================================================
-- Add icing_decorations to support_element category
-- ============================================================================
-- Run this SQL directly in Supabase SQL Editor
-- This adds the missing icing_decorations type for support elements
-- so the AI can properly classify piped icing decorations (swirls, dollops)

INSERT INTO pricing_rules (
  item_key,
  item_type,
  category,
  classification,
  size,
  coverage,
  description,
  price,
  quantity_rule,
  multiplier_rule,
  special_conditions,
  is_active
) VALUES
  -- Tiny size
  (
    'icing_decorations_tiny',
    'icing_decorations',
    'support_element',
    'icing',
    'tiny',
    NULL,
    'Tiny icing decorations (piped swirls, dollops, star tip decorations)',
    0,
    NULL,
    NULL,
    NULL,
    true
  ),
  -- Small size
  (
    'icing_decorations_small',
    'icing_decorations',
    'support_element',
    'icing',
    'small',
    NULL,
    'Small icing decorations (piped swirls, dollops, star tip decorations)',
    0,
    NULL,
    NULL,
    NULL,
    true
  ),
  -- Medium size
  (
    'icing_decorations_medium',
    'icing_decorations',
    'support_element',
    'icing',
    'medium',
    NULL,
    'Medium icing decorations (piped swirls, dollops, star tip decorations)',
    0,
    NULL,
    NULL,
    NULL,
    true
  ),
  -- Large size
  (
    'icing_decorations_large',
    'icing_decorations',
    'support_element',
    'icing',
    'large',
    NULL,
    'Large icing decorations (piped swirls, dollops, star tip decorations)',
    0,
    NULL,
    NULL,
    NULL,
    true
  )
ON CONFLICT (item_key) DO NOTHING;

-- Verify the insertion
SELECT
  item_key,
  category,
  classification,
  size,
  description
FROM pricing_rules
WHERE item_type = 'icing_decorations'
  AND category = 'support_element'
  AND is_active = true
ORDER BY
  CASE size
    WHEN 'tiny' THEN 1
    WHEN 'small' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'large' THEN 4
  END;
