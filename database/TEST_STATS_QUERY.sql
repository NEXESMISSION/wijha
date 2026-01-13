-- Test Query: Verify the stats work
-- Run this in Supabase SQL Editor to test

-- Test 1: Check if function exists and works
SELECT * FROM get_profile_stats();

-- Test 2: Check direct query (should work with public policy)
SELECT 
  role,
  COUNT(*) as count
FROM profiles
WHERE role IN ('student', 'creator')
GROUP BY role;

-- Test 3: Check individual counts
SELECT COUNT(*) as student_count FROM profiles WHERE role = 'student';
SELECT COUNT(*) as creator_count FROM profiles WHERE role = 'creator';

-- If all three queries work, the issue is in the frontend code
-- Check browser console for errors

