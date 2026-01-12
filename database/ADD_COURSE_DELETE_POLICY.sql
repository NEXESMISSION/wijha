-- ============================================
-- ADD DELETE POLICY FOR COURSES
-- Allows admins to delete courses
-- ============================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can delete any course" ON courses;

-- Create policy for admins to delete courses
CREATE POLICY "Admins can delete any course"
  ON courses FOR DELETE
  USING (is_user_admin(auth.uid()));

-- ============================================
-- DONE!
-- ============================================

