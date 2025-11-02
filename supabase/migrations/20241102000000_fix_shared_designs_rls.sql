-- Enable RLS on cakegenie_shared_designs table
ALTER TABLE cakegenie_shared_designs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to shared designs" ON cakegenie_shared_designs;
DROP POLICY IF EXISTS "Allow authenticated users to insert shared designs" ON cakegenie_shared_designs;
DROP POLICY IF EXISTS "Allow authenticated users to update their own shared designs" ON cakegenie_shared_designs;
DROP POLICY IF EXISTS "Allow anon users to insert shared designs" ON cakegenie_shared_designs;

-- Policy 1: Allow anyone (including anonymous users) to read shared designs
CREATE POLICY "Allow public read access to shared designs"
ON cakegenie_shared_designs
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow authenticated and anonymous users to insert shared designs
CREATE POLICY "Allow users to insert shared designs"
ON cakegenie_shared_designs
FOR INSERT
TO public
WITH CHECK (true);

-- Policy 3: Allow users to update shared designs they created (for AI enrichment)
CREATE POLICY "Allow users to update shared designs"
ON cakegenie_shared_designs
FOR UPDATE
TO public
USING (
  -- Allow if user created it, or if it's their anonymous session
  auth.uid() = created_by_user_id
  OR created_by_user_id IS NULL
)
WITH CHECK (
  auth.uid() = created_by_user_id
  OR created_by_user_id IS NULL
);

-- Grant necessary permissions
GRANT SELECT ON cakegenie_shared_designs TO anon, authenticated;
GRANT INSERT ON cakegenie_shared_designs TO anon, authenticated;
GRANT UPDATE ON cakegenie_shared_designs TO anon, authenticated;
