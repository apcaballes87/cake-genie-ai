-- Keep the Cakes & Memories base-price catalog independent from Genie.ph.
-- This clones every current column, constraint, index, and price row from the
-- existing authoritative catalog in one transactional migration.
CREATE TABLE public.productsizes_cakesandmemories (
  LIKE public.productsizes_cakegenie INCLUDING ALL
);

-- LIKE copies a serial column's default expression verbatim. Give the clone
-- its own sequence so future C&M price rows cannot consume Genie IDs.
CREATE SEQUENCE public.productsizes_cakesandmemories_id_seq;
ALTER SEQUENCE public.productsizes_cakesandmemories_id_seq
  OWNED BY public.productsizes_cakesandmemories.id;
ALTER TABLE public.productsizes_cakesandmemories
  ALTER COLUMN id SET DEFAULT nextval('public.productsizes_cakesandmemories_id_seq'::regclass);

INSERT INTO public.productsizes_cakesandmemories
SELECT *
FROM public.productsizes_cakegenie;

SELECT setval(
  'public.productsizes_cakesandmemories_id_seq',
  (SELECT max(id) FROM public.productsizes_cakesandmemories),
  true
);

-- The alternate catalog is only read by the server-side, feature-gated route.
-- Do not expose direct client reads while the rollout flag is off.
ALTER TABLE public.productsizes_cakesandmemories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.productsizes_cakesandmemories FROM anon, authenticated;
