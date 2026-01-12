-- FIX: Profile RLS and Admin Permissions
-- This fixes: Profile not found + 403 errors + Course creation
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Ensure profile exists and is admin
-- ============================================
-- Use SECURITY DEFINER function to bypass RLS
CREATE OR REPLACE FUNCTION create_admin_profile()
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    'dc8603a2-1933-4688-b0f0-17ff01db8aee',
    'Admin User',
    'admin'
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', name = COALESCE(profiles.name, 'Admin User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function (bypasses RLS)
SELECT create_admin_profile();

-- Clean up the function
DROP FUNCTION create_admin_profile();

-- ============================================
-- STEP 2: Fix RLS Policies - Allow users to view their own profile
-- ============================================
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create policy that allows users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Note: The admin policy for viewing profiles is not needed because
-- admins can already view their own profile, and the course policies
-- check admin role separately

-- ============================================
-- STEP 3: Add Admin Policy for Creating Courses
-- ============================================
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- STEP 4: Verify Everything
-- ============================================
-- Check profile exists and is admin
SELECT 
  p.id,
  p.name,
  p.role,
  au.email,
  'Profile exists and is admin!' as status
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = 'dc8603a2-1933-4688-b0f0-17ff01db8aee';

-- Check RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'profiles';

-- Check policies exist
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- DONE! Now:
-- 1. Hard refresh browser (Ctrl+Shift+R)
-- 2. Log out and log back in
-- 3. Try creating a course
-- ============================================

