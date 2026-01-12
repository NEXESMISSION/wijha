-- Fix Creator Course Creation - 403 Error
-- Run this in Supabase SQL Editor
-- Replace USER_ID with: a7b752ec-6f61-454e-becf-d8166ee60347

-- STEP 1: Verify user's profile and role
SELECT 
  p.id,
  p.name,
  p.role,
  au.email
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = 'a7b752ec-6f61-454e-becf-d8166ee60347';

-- STEP 2: Ensure user has 'creator' role
UPDATE profiles 
SET role = 'creator' 
WHERE id = 'a7b752ec-6f61-454e-becf-d8166ee60347';

-- STEP 3: Verify the RLS policy exists for creators
-- Check if policy exists
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'courses'
  AND policyname = 'Creators can create courses';

-- STEP 4: Recreate the policy if needed (drop and recreate)
DROP POLICY IF EXISTS "Creators can create courses" ON courses;
CREATE POLICY "Creators can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'creator'
    )
  );

-- STEP 5: Also add policy for admins (in case you want to create courses as admin)
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- STEP 6: Verify policies
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'USING: ' || qual
  END as policy_definition
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'courses'
  AND cmd = 'INSERT'
ORDER BY policyname;

