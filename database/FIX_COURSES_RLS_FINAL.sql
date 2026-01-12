-- ============================================
-- FINAL FIX FOR COURSES RLS INFINITE RECURSION
-- ============================================
-- This uses SECURITY DEFINER functions to avoid RLS recursion
-- ============================================

-- STEP 1: Create helper functions that bypass RLS
-- ============================================

-- Function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is creator (bypasses RLS)
CREATE OR REPLACE FUNCTION is_user_creator(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'creator'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- STEP 2: Drop ALL existing policies on courses table
-- ============================================
DROP POLICY IF EXISTS "Anyone can view published courses" ON courses;
DROP POLICY IF EXISTS "Creators can view their own courses" ON courses;
DROP POLICY IF EXISTS "Admins can view all courses" ON courses;
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON courses;
DROP POLICY IF EXISTS "Students can view enrolled courses" ON courses;
DROP POLICY IF EXISTS "Creators can create courses" ON courses;
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
DROP POLICY IF EXISTS "Creators can update their own courses" ON courses;
DROP POLICY IF EXISTS "Admins can update any course" ON courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;

-- STEP 3: Create simple, non-recursive SELECT policies
-- ============================================

-- Policy 1: Anyone can view published courses (public)
CREATE POLICY "Anyone can view published courses"
  ON courses FOR SELECT
  USING (status = 'published');

-- Policy 2: Creators can view their own courses (simple check, no recursion)
CREATE POLICY "Creators can view their own courses"
  ON courses FOR SELECT
  USING (creator_id = auth.uid());

-- Policy 3: Admins can view all courses (using function to avoid recursion)
CREATE POLICY "Admins can view all courses"
  ON courses FOR SELECT
  USING (is_user_admin(auth.uid()));

-- STEP 4: Create INSERT policies
-- ============================================

-- Creators can create courses
CREATE POLICY "Creators can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = creator_id
    AND is_user_creator(auth.uid())
  );

-- Admins can create courses
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_user_admin(auth.uid())
  );

-- STEP 5: Create UPDATE policies
-- ============================================

-- Creators can update their own courses
CREATE POLICY "Creators can update their own courses"
  ON courses FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Admins can update any course
CREATE POLICY "Admins can update any course"
  ON courses FOR UPDATE
  USING (is_user_admin(auth.uid()));

-- STEP 6: Create DELETE policy
-- ============================================

-- Admins can delete courses
CREATE POLICY "Admins can delete courses"
  ON courses FOR DELETE
  USING (is_user_admin(auth.uid()));

-- ============================================
-- DONE!
-- ============================================
-- The policies now use SECURITY DEFINER functions
-- that bypass RLS, preventing infinite recursion.
-- ============================================

