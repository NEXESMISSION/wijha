-- ============================================
-- FIX INFINITE RECURSION IN COURSES RLS POLICY
-- ============================================
-- The error "infinite recursion detected in policy for relation 'courses'"
-- is caused by policies that reference courses table within themselves.
-- This script fixes that by removing the problematic policy and using
-- simpler, non-recursive policies.
-- ============================================

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON courses;

-- The existing policies should be sufficient:
-- 1. "Anyone can view published courses" - allows viewing published courses
-- 2. "Creators can view their own courses" - allows creators to view their courses
-- 3. "Admins can view all courses" - allows admins to view all courses

-- These policies don't create recursion because they don't reference
-- other tables that might reference courses back.

-- If you need students to view courses they're enrolled in (even if not published),
-- we can add a simpler policy that doesn't cause recursion:

-- This policy allows students to view courses they're enrolled in
-- but only checks enrollments directly without nested queries
CREATE POLICY "Students can view enrolled courses"
  ON courses FOR SELECT
  USING (
    -- Allow if published (public)
    status = 'published' OR
    -- Allow if user is the creator
    creator_id = auth.uid() OR
    -- Allow if user is admin (using function to avoid recursion)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ) OR
    -- Allow if student has enrollment (simple check, no nested course query)
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = courses.id
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'approved'
    )
  );

-- ============================================
-- DONE!
-- ============================================
-- This should fix the infinite recursion error.
-- The policy now checks enrollments directly without
-- creating circular references.
-- ============================================

