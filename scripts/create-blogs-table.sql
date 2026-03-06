-- Blog Migration: Create blogs table
-- Run this script in Supabase SQL Editor

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS blogs;

-- Create blogs table
CREATE TABLE blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    date DATE NOT NULL,
    author TEXT NOT NULL DEFAULT 'Genie.ph',
    author_url TEXT,
    image TEXT,
    keywords TEXT,
    cake_search_keywords TEXT,
    related_cakes_intro TEXT,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TEMPORARILY disable RLS for migration (re-enable after if needed)
ALTER TABLE blogs DISABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_blogs_slug ON blogs(slug);
CREATE INDEX idx_blogs_date ON blogs(date DESC);
CREATE INDEX idx_blogs_cake_search_keywords ON blogs(cake_search_keywords);
CREATE INDEX idx_blogs_is_published ON blogs(is_published) WHERE is_published = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_blogs_updated_at
    BEFORE UPDATE ON blogs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify table created
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'blogs' ORDER BY ordinal_position;
