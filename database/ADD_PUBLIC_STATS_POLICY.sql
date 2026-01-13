-- Add public policy to allow reading profile role counts for stats
-- This allows the landing page to show real-time student and creator counts
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create Database Function (Recommended - More Secure)
-- ============================================
-- This function bypasses RLS and returns only counts
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

-- Grant execute permission to public (anon = not logged in, authenticated = logged in)
GRANT EXECUTE ON FUNCTION get_profile_stats() TO anon, authenticated;

-- ============================================
-- STEP 2: Add Public Policy (Fallback - Less Secure but Works)
-- ============================================
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view profile role counts for stats" ON profiles;

-- Create policy that allows anyone to count profiles by role (for stats)
-- This is needed as a fallback if the function doesn't work
CREATE POLICY "Public can view profile role counts for stats"
  ON profiles FOR SELECT
  USING (true);

-- ============================================
-- STEP 3: Verify Everything Works
-- ============================================
-- Test the function
SELECT * FROM get_profile_stats();

-- Test the direct query (should work with the policy)
SELECT 
  role,
  COUNT(*) as count
FROM profiles
WHERE role IN ('student', 'creator')
GROUP BY role;

