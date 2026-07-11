ALTER TABLE public.cakegenie_search_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_search_analytics ON public.cakegenie_search_analytics;
CREATE POLICY public_read_search_analytics
  ON public.cakegenie_search_analytics
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.cakegenie_search_analytics TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cakegenie_search_analytics FROM anon, authenticated;
