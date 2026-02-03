-- Create client_errors table for capturing JavaScript errors from real users
-- This helps debug issues that Clarity's "script error" can't show details for

CREATE TABLE IF NOT EXISTS client_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Error details
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_type TEXT, -- 'error', 'unhandledrejection', 'cookie_blocked', etc.
    
    -- Context
    page_url TEXT,
    page_path TEXT,
    
    -- User/Device info (anonymized)
    user_agent TEXT,
    viewport_width INTEGER,
    viewport_height INTEGER,
    
    -- Session info (optional, for correlation with Clarity)
    session_id TEXT,
    
    -- Additional metadata (JSON for flexibility)
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for querying by error type and time
CREATE INDEX IF NOT EXISTS idx_client_errors_type_created 
ON client_errors(error_type, created_at DESC);

-- Index for querying by page path
CREATE INDEX IF NOT EXISTS idx_client_errors_path 
ON client_errors(page_path, created_at DESC);

-- RLS: Allow anonymous inserts (errors can come from any user)
ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert errors (logging)
CREATE POLICY "Allow anonymous error logging" ON client_errors
    FOR INSERT
    WITH CHECK (true);

-- Policy: Only authenticated users can read (for admin dashboard)
CREATE POLICY "Allow authenticated users to read errors" ON client_errors
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Comment for clarity
COMMENT ON TABLE client_errors IS 'Captures client-side JavaScript errors for debugging issues not visible in Clarity recordings';
