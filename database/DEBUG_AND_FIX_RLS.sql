-- Debug and Fix RLS Policy for Course Creation
-- Run this ENTIRE script in Supabase SQL Editor

-- STEP 1: Check current user's profile
SELECT 
  p.id as profile_id,
  p.name,
  p.role,
  au.id as auth_user_id,
  au.email,
  CASE 
    WHEN p.id = au.id THEN '✅ IDs match'
    ELSE '❌ IDs do not match'
  END as id_match
FROM profiles p
FULL OUTER JOIN auth.users au ON au.id = p.id
WHERE au.id = 'a7b752ec-6f61-454e-becf-d8166ee60347' 
   OR p.id = 'a7b752ec-6f61-454e-becf-d8166ee60347';

-- STEP 2: Ensure profile exists and has creator role (using SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION ensure_creator_profile()
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    'a7b752ec-6f61-454e-becf-d8166ee60347',
    'saif1',
    'creator'
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = 'creator', name = COALESCE(profiles.name, 'saif1');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT ensure_creator_profile();
DROP FUNCTION ensure_creator_profile();

-- STEP 3: Drop ALL existing INSERT policies on courses
DROP POLICY IF EXISTS "Creators can create courses" ON courses;
DROP POLICY IF EXISTS "Admins can create courses" ON courses;

-- STEP 4: Create a simpler, more permissive creator policy
-- This policy checks if the user is authenticated and has creator role
CREATE POLICY "Creators can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL AND
    -- creator_id must match authenticated user
    auth.uid() = creator_id AND
    -- User must have creator role in profiles
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
        AND profiles.role = 'creator'
    )
  );

-- STEP 5: Create admin policy
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
  );

-- STEP 6: Test the policy (this will show if it works)
-- Note: This test query will fail if you're not authenticated, but that's OK
-- The actual insert from your app should work if the policy is correct
SELECT 
  'Policy check:' as test,
  auth.uid() as current_user_id,
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.role = 'creator'
  ) as has_creator_role;

-- STEP 7: Verify policies were created
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'courses'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- STEP 8: Check RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'courses';

