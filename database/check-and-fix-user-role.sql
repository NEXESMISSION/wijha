-- Check and Fix User Role
-- Run this in Supabase SQL Editor

-- 1. Check your current role (replace with your email)
SELECT 
  au.email,
  p.name,
  p.role,
  p.id as user_id,
  au.raw_user_meta_data
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'your-email@example.com';  -- Replace with your email

-- 2. Update your role to admin (replace with your email)
UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- 3. Verify the update worked
SELECT 
  au.email,
  p.name,
  p.role
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'your-email@example.com';

-- 4. If you want to see ALL users and their roles:
SELECT 
  au.email,
  p.name,
  p.role,
  p.id as user_id
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY p.role, au.email;

