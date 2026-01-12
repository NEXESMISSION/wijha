-- Make a User Admin or Creator
-- Replace YOUR_USER_EMAIL with your actual email address

-- Option 1: Make user admin by email
UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'YOUR_USER_EMAIL_HERE'
);

-- Option 2: Make user creator by email
UPDATE profiles 
SET role = 'creator' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'YOUR_USER_EMAIL_HERE'
);

-- Option 3: Make user admin by user ID (get this from browser console: user.id)
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID_HERE';

-- Option 4: Make user creator by user ID
-- UPDATE profiles SET role = 'creator' WHERE id = 'YOUR_USER_ID_HERE';

-- To check all users and their roles:
SELECT 
  au.email,
  p.name,
  p.role,
  p.id
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY p.role, au.email;

