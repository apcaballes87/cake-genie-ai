-- Replace the public new-customer campaign code and reduce its discount.
-- If NEW10 was created manually before this migration, preserve that row and
-- retire NEW20 instead of failing on the unique code constraint.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.discount_codes WHERE code = 'NEW10') THEN
    UPDATE public.discount_codes
    SET discount_percentage = 10,
        is_active = true
    WHERE code = 'NEW10';

    UPDATE public.discount_codes
    SET is_active = false
    WHERE code = 'NEW20';
  ELSE
    UPDATE public.discount_codes
    SET code = 'NEW10',
        discount_percentage = 10
    WHERE code = 'NEW20';
  END IF;
END $$;
