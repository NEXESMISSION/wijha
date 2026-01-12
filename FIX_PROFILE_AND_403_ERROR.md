# Fix: Profile Missing and 403 Error

## Problem
Your profile doesn't exist in the database, which causes:
- 403 error when creating courses
- Can't determine your role (admin/creator/student)
- RLS policies fail because they check the profile role

## Quick Fix

### Step 1: Create Your Profile and Set as Admin

Run this SQL in **Supabase SQL Editor**:

```sql
-- Create profile for user dc8603a2-1933-4688-b0f0-17ff01db8aee and set as admin
INSERT INTO profiles (id, name, role)
VALUES (
  'dc8603a2-1933-4688-b0f0-17ff01db8aee',
  'Admin User',
  'admin'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', name = COALESCE(profiles.name, 'Admin User');
```

### Step 2: Add Admin Policy for Creating Courses

Run this SQL to ensure admins can create courses:

```sql
-- Add policy for admins to create courses
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
```

### Step 3: Refresh Browser

After running the SQL:
1. **Hard refresh** your browser (Ctrl+Shift+R)
2. Or **log out and log back in**

### Step 4: Verify

Check that your profile exists:

```sql
SELECT 
  p.id,
  p.name,
  p.role,
  au.email
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = 'dc8603a2-1933-4688-b0f0-17ff01db8aee';
```

You should see:
- `role: 'admin'`
- Your email address

## Alternative: Create Profile by Email

If you prefer to use your email instead of user ID:

```sql
-- Create profile by email
INSERT INTO profiles (id, name, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', 'Admin User'),
  'admin'
FROM auth.users au
WHERE au.email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';
```

## Files Created

- `database/create-profile-and-set-admin.sql` - Ready-to-use SQL script
- `database/fix-admin-and-creator-permissions.sql` - Admin policies

