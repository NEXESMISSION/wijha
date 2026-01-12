-- ============================================
-- COMPLETE FIX FOR COURSES RLS INFINITE RECURSION
-- ============================================
-- This script removes all problematic policies and creates
-- simple, non-recursive policies that work correctly
-- ============================================

-- STEP 1: Drop ALL existing policies on courses table
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

-- STEP 2: Create simple, non-recursive SELECT policies
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
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
      LIMIT 1
    )
  );

-- Policy 4: Students can view courses they're enrolled in
-- NOTE: This policy is commented out to avoid recursion
-- Students can still view published courses via Policy 1
-- If you need students to view unpublished enrolled courses,
-- you'll need to handle this in the application layer
-- CREATE POLICY "Students can view enrolled courses"
--   ON courses FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM enrollments
--       WHERE enrollments.course_id = courses.id
--       AND enrollments.student_id = auth.uid()
--       AND enrollments.status = 'approved'
--       LIMIT 1
--     )
--   );

-- STEP 3: Create INSERT policies
-- ============================================

-- Creators can create courses
CREATE POLICY "Creators can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = creator_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'creator'
      LIMIT 1
    )
  );

-- Admins can create courses
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      LIMIT 1
    )
  );

-- STEP 4: Create UPDATE policies
-- ============================================

-- Creators can update their own courses
CREATE POLICY "Creators can update their own courses"
  ON courses FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Admins can update any course
CREATE POLICY "Admins can update any course"
  ON courses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      LIMIT 1
    )
  );

-- STEP 5: Create DELETE policy
-- ============================================

-- Admins can delete courses
CREATE POLICY "Admins can delete courses"
  ON courses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      LIMIT 1
    )
  );

-- ============================================
-- DONE!
-- ============================================
-- The policies are now simple and non-recursive.
-- They use LIMIT 1 in subqueries to prevent any
-- potential issues with multiple rows.
-- ============================================

    