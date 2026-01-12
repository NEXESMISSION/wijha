-- ============================================
-- ADD ENROLLMENT RESTRICTIONS
-- Allows students to re-enroll and adds restriction functionality
-- ============================================

-- Add restriction fields to enrollments table
ALTER TABLE enrollments 
ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS restriction_reason TEXT;

-- Remove the UNIQUE constraint to allow multiple enrollment attempts
-- (Students can now enroll multiple times unless restricted)
ALTER TABLE enrollments 
DROP CONSTRAINT IF EXISTS enrollments_student_id_course_id_key;

-- Create a new unique constraint that only applies to non-rejected enrollments
-- This prevents duplicate pending/approved enrollments but allows re-enrollment after rejection
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_student_course_active_unique 
ON enrollments (student_id, course_id) 
WHERE status IN ('pending', 'approved');

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_enrollments_is_restricted ON enrollments(is_restricted);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course ON enrollments(student_id, course_id);

-- ============================================
-- DONE!
-- ============================================
-- Now:
-- 1. Students can enroll multiple times (unless restricted)
-- 2. Only one pending/approved enrollment per student per course
-- 3. Rejected enrollments don't block new enrollment attempts
-- 4. Admins can restrict students from re-enrolling
-- ============================================

