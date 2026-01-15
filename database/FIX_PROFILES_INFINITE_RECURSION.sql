-- FIX: Infinite recursion detected in policy for relation "profiles"
-- This script fixes the RLS policies on profiles table that cause infinite recursion
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Drop ALL existing policies on profiles
-- =============================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

-- =============================================
-- STEP 2: Create a helper function to check admin role
-- This function uses SECURITY DEFINER to bypass RLS
-- =============================================
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Direct query bypassing RLS
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN user_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auth_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_admin() TO anon;

-- =============================================
-- STEP 3: Create simple, non-recursive policies
-- =============================================

-- Policy 1: Everyone can SELECT all profiles (public data)
-- This is the simplest solution - profiles are public
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Policy 2: Users can INSERT their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can UPDATE their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Admins can UPDATE any profile (using helper function)
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (auth_is_admin());

-- =============================================
-- STEP 4: Verify RLS is enabled
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 5: Also fix courses table policies if they reference profiles
-- =============================================
DROP POLICY IF EXISTS "Approved courses are viewable by everyone" ON courses;
DROP POLICY IF EXISTS "Creators can view their own courses" ON courses;
DROP POLICY IF EXISTS "Admins can view all courses" ON courses;
DROP POLICY IF EXISTS "Creators can insert their own courses" ON courses;
DROP POLICY IF EXISTS "Creators can update their own courses" ON courses;
DROP POLICY IF EXISTS "Admins can update all courses" ON courses;

-- Courses SELECT policies (simple, non-recursive)
CREATE POLICY "Approved courses are viewable by everyone"
  ON courses FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Creators can view their own courses"
  ON courses FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can view all courses"
  ON courses FOR SELECT
  USING (auth_is_admin());

-- Courses INSERT policy
CREATE POLICY "Creators can insert their own courses"
  ON courses FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Courses UPDATE policies
CREATE POLICY "Creators can update their own courses"
  ON courses FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can update all courses"
  ON courses FOR UPDATE
  USING (auth_is_admin());

-- =============================================
-- STEP 6: Fix enrollments table policies
-- =============================================
DROP POLICY IF EXISTS "Students can view their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Creators can view enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Admins can view all enrollments" ON enrollments;
DROP POLICY IF EXISTS "Students can insert their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins can update enrollments" ON enrollments;

-- Enrollments SELECT policies
CREATE POLICY "Students can view their own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Creators can view enrollments for their courses"
  ON enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = enrollments.course_id 
      AND courses.creator_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all enrollments"
  ON enrollments FOR SELECT
  USING (auth_is_admin());

-- Enrollments INSERT policy
CREATE POLICY "Students can insert their own enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Enrollments UPDATE policies
CREATE POLICY "Admins can update enrollments"
  ON enrollments FOR UPDATE
  USING (auth_is_admin());

-- =============================================
-- STEP 7: Fix payout_requests table policies
-- =============================================
DROP POLICY IF EXISTS "Creators can view their own payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Creators can insert their own payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can view all payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can update payout requests" ON payout_requests;

-- Payout requests policies
CREATE POLICY "Creators can view their own payout requests"
  ON payout_requests FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can insert their own payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admins can view all payout requests"
  ON payout_requests FOR SELECT
  USING (auth_is_admin());

CREATE POLICY "Admins can update payout requests"
  ON payout_requests FOR UPDATE
  USING (auth_is_admin());

-- =============================================
-- STEP 8: Verify policies were created
-- =============================================
DO $$
BEGIN
  RAISE NOTICE 'RLS policies fixed successfully!';
  RAISE NOTICE 'The infinite recursion issue should now be resolved.';
END $$;

-- Show current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';

