DO $$
BEGIN
  UPDATE pricing_rules
  SET
    category = 'support_element',
    classification = 'support',
    size = NULL,
    coverage = NULL,
    description = 'Satin or organza fabric ribbon, bow, side wrap, or structured translucent ruffle',
    price = 100,
    quantity_rule = NULL,
    multiplier_rule = NULL,
    special_conditions = NULL,
    is_active = true,
    updated_at = NOW()
  WHERE item_type = 'satin_ribbon';

  IF NOT FOUND THEN
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
      is_active,
      updated_at
    ) VALUES (
      'satin_ribbon',
      'satin_ribbon',
      'support_element',
      'support',
      NULL,
      NULL,
      'Satin or organza fabric ribbon, bow, side wrap, or structured translucent ruffle',
      100,
      NULL,
      NULL,
      NULL,
      true,
      NOW()
    );
  END IF;
END $$;
