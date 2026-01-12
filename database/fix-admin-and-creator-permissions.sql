-- Fix Admin and Creator Permissions
-- Run this in Supabase SQL Editor

-- 1. Add policy for admins to create courses (bypass RLS for admins)
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Note: Admin policies for modules and lessons already exist in the schema
-- They are named "Admins can manage all modules" and "Admins can manage all lessons"
-- If you get errors about these policies, they're already created

-- 4. To make yourself an admin, run this query (replace YOUR_USER_ID with your actual user ID):
-- You can find your user ID by checking auth.users table or from the browser console (user.id)
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID_HERE';

-- 5. To make yourself a creator, run this query:
-- UPDATE profiles SET role = 'creator' WHERE id = 'YOUR_USER_ID_HERE';

-- 6. To check your current role:
-- SELECT id, name, role FROM profiles WHERE id = auth.uid();

