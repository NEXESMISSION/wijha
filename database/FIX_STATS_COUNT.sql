-- Quick Fix: Allow public to read profile counts for stats
-- Run this in Supabase SQL Editor - This will fix the 0 count issue immediately

-- Step 1: Add public policy to allow reading profiles (for counting)
DROP POLICY IF EXISTS "Public can view profile role counts for stats" ON profiles;

CREATE POLICY "Public can view profile role counts for stats"
  ON profiles FOR SELECT
  USING (true);

-- Step 2: Create the database function (more secure, optional but recommended)
-- Drop function if exists
DROP FUNCTION IF EXISTS get_profile_stats();

CREATE OR REPLACE FUNCTION get_profile_stats()
RETURNS TABLE (
  student_count BIGINT,
  creator_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE role = 'student')::BIGINT as student_count,
    (SELECT COUNT(*) FROM profiles WHERE role = 'creator')::BIGINT as creator_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to everyone (anon = not logged in, authenticated = logged in)
GRANT EXECUTE ON FUNCTION get_profile_stats() TO anon, authenticated, public;

-- Step 3: Test it works
SELECT * FROM get_profile_stats();

-- You should see:
-- student_count | creator_count
-- --------------|---------------
-- 2             | 1

