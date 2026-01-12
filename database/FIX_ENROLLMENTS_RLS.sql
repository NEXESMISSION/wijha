-- ============================================
-- FIX ENROLLMENTS RLS POLICY FOR NESTED QUERIES
-- ============================================
-- This fixes the 403 error when students try to view their enrollments
-- The issue is that nested queries need proper RLS policies

-- Ensure students can view courses when querying enrollments
-- This policy allows students to view course details when they have an enrollment
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON courses;
CREATE POLICY "Students can view courses they are enrolled in"
  ON courses FOR SELECT
  USING (
    -- Allow if course is published (public)
    status = 'published' OR
    -- Allow if student is enrolled
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = courses.id 
      AND enrollments.student_id = auth.uid()
    ) OR
    -- Allow if user is the creator
    creator_id = auth.uid() OR
    -- Allow if user is admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

