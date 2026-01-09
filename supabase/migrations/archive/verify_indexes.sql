-- Verify all indexes were created successfully
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('cakegenie_cart', 'cakegenie_addresses')
ORDER BY tablename, indexname;
