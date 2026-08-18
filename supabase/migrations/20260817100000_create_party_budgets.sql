CREATE TABLE IF NOT EXISTS public.cakegenie_party_budgets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  party_date date,
  guest_count integer NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  total_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  budget_amount numeric(12, 2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  currency text NOT NULL DEFAULT 'PHP' CHECK (currency IN ('PHP', 'USD', 'EUR', 'GBP')),
  budget_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cakegenie_party_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their party budget" ON public.cakegenie_party_budgets;
CREATE POLICY "Customers can view their party budget"
  ON public.cakegenie_party_budgets
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "Customers can create their party budget" ON public.cakegenie_party_budgets;
CREATE POLICY "Customers can create their party budget"
  ON public.cakegenie_party_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "Customers can update their party budget" ON public.cakegenie_party_budgets;
CREATE POLICY "Customers can update their party budget"
  ON public.cakegenie_party_budgets
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

DROP POLICY IF EXISTS "Customers can delete their party budget" ON public.cakegenie_party_budgets;
CREATE POLICY "Customers can delete their party budget"
  ON public.cakegenie_party_budgets
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cakegenie_party_budgets TO authenticated;

CREATE OR REPLACE FUNCTION public.set_party_budget_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_party_budget_updated_at ON public.cakegenie_party_budgets;
CREATE TRIGGER set_party_budget_updated_at
  BEFORE UPDATE ON public.cakegenie_party_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_party_budget_updated_at();
