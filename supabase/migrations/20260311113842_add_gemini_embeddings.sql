-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to cakegenie_analysis_cache (768 dimensions for gemini-embedding-2-preview)
ALTER TABLE cakegenie_analysis_cache 
ADD COLUMN IF NOT EXISTS image_embedding vector(768);

-- Create an HNSW index on the new column for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS cakegenie_analysis_cache_embedding_hnsw_idx 
ON cakegenie_analysis_cache 
USING hnsw (image_embedding vector_cosine_ops);

-- Create a function to find similar images based on embedding
CREATE OR REPLACE FUNCTION find_similar_images_by_embedding(
  new_embedding vector(768),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  p_hash text,
  original_image_url text,
  price numeric,
  keywords text,
  slug text,
  alt_text text,
  availability text[],
  image_width integer,
  image_height integer,
  analysis_json jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.p_hash,
    c.original_image_url,
    c.price,
    c.keywords,
    c.slug,
    c.alt_text,
    c.availability,
    c.image_width,
    c.image_height,
    c.analysis_json,
    1 - (c.image_embedding <=> new_embedding) AS similarity
  FROM cakegenie_analysis_cache c
  WHERE 1 - (c.image_embedding <=> new_embedding) > match_threshold
  ORDER BY c.image_embedding <=> new_embedding
  LIMIT match_count;
END;
$$;
