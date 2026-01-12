-- Create Profile and Set Admin Role
-- Run this in Supabase SQL Editor
-- Replace YOUR_USER_ID with: dc8603a2-1933-4688-b0f0-17ff01db8aee

-- Option 1: Create profile and set as admin by user ID
INSERT INTO profiles (id, name, role)
VALUES (
  'dc8603a2-1933-4688-b0f0-17ff01db8aee',
  'Admin User',
  'admin'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', name = COALESCE(profiles.name, 'Admin User');

-- Option 2: Create profile and set as admin by email (if you know the email)
-- INSERT INTO profiles (id, name, role)
-- SELECT 
--   au.id,
--   COALESCE(au.raw_user_meta_data->>'name', 'Admin User'),
--   'admin'
-- FROM auth.users au
-- WHERE au.email = 'your-email@example.com'
-- ON CONFLICT (id) DO UPDATE 
-- SET role = 'admin';

-- Option 3: Update existing profile to admin (if profile exists)
-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE id = 'dc8603a2-1933-4688-b0f0-17ff01db8aee';

-- Verify the profile was created/updated
SELECT 
  p.id,
  p.name,
  p.role,
  au.email
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = 'dc8603a2-1933-4688-b0f0-17ff01db8aee';

