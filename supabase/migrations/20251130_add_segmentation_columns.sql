-- Add segmentation columns to cakegenie_analysis_cache table
-- This allows storing SAM 3 segmentation masks and model versioning

-- Add segmentation_data column (JSONB) to store the masks
ALTER TABLE cakegenie_analysis_cache 
ADD COLUMN IF NOT EXISTS segmentation_data JSONB DEFAULT NULL;

-- Add model_version column (TEXT) to track which model generated the analysis
-- Default to 'gemini-2.5-flash' for existing records or 'legacy'
ALTER TABLE cakegenie_analysis_cache 
ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'gemini-2.5-flash';

-- Add has_segmentation column (BOOLEAN) for easy filtering/indexing
ALTER TABLE cakegenie_analysis_cache 
ADD COLUMN IF NOT EXISTS has_segmentation BOOLEAN DEFAULT FALSE;

-- Create an index on has_segmentation for faster queries
CREATE INDEX IF NOT EXISTS idx_analysis_cache_has_segmentation 
ON cakegenie_analysis_cache(has_segmentation);

-- Comment on columns for clarity
COMMENT ON COLUMN cakegenie_analysis_cache.segmentation_data IS 'Stores SAM 3 segmentation masks (RLE or polygon)';
COMMENT ON COLUMN cakegenie_analysis_cache.model_version IS 'Model version used for analysis (e.g., gemini-2.5-flash, sam-3)';
COMMENT ON COLUMN cakegenie_analysis_cache.has_segmentation IS 'Flag to indicate if segmentation data is available';
