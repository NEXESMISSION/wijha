-- COMPLETE FIX: Create Profile + Set Admin + Add Policies
-- Run this entire script in Supabase SQL Editor
-- This fixes: missing profile, 403 errors, and admin permissions

-- ============================================
-- STEP 1: Create Profile for User
-- ============================================
-- Replace the user ID below with: dc8603a2-1933-4688-b0f0-17ff01db8aee
INSERT INTO profiles (id, name, role)
VALUES (
  'dc8603a2-1933-4688-b0f0-17ff01db8aee',
  'Admin User',
  'admin'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', name = COALESCE(profiles.name, 'Admin User');

-- ============================================
-- STEP 2: Add Admin Policy for Creating Courses
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
-- STEP 3: Verify Everything Works
-- ============================================
-- Check your profile
SELECT 
  p.id,
  p.name,
  p.role,
  au.email,
  'Profile exists!' as status
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = 'dc8603a2-1933-4688-b0f0-17ff01db8aee';

-- Check admin policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'courses' 
  AND policyname LIKE '%admin%'
ORDER BY policyname;

-- ============================================
-- DONE! Now:
-- 1. Refresh your browser (Ctrl+Shift+R)
-- 2. Try creating a course again
-- ============================================

