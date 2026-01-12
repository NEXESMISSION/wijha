# Fix RLS Error: "new row violates row-level security policy"

## Problem
You're getting this error because your user profile doesn't have the 'creator' or 'admin' role required to create courses.

## Solution Options

### Option 1: Make Yourself Admin (Recommended)
Run this SQL in Supabase SQL Editor:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

### Option 2: Make Yourself Creator
Run this SQL in Supabase SQL Editor:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET role = 'creator' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

### Option 3: Find Your User ID First
If you don't know your email, check your user ID from the browser console:

1. Open browser console (F12)
2. Type: `localStorage.getItem('sb-mxsydpljfseanvwxsrgj-auth-token')` (or check the user object)
3. Or run this SQL to see all users:

```sql
SELECT 
  au.email,
  p.name,
  p.role,
  p.id as user_id
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY p.role, au.email;
```

Then update by user ID:

```sql
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID
UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID_HERE';
```

### Option 4: Add Admin Policy (Allows Admins to Create Courses)
Run the SQL file: `database/fix-admin-and-creator-permissions.sql`

This adds a policy that allows admins to create courses, then you can make yourself admin using Option 1.

## Quick Steps

1. Go to Supabase Dashboard → SQL Editor
2. Run one of the SQL queries above (replace email/user ID)
3. Refresh your browser
4. Try creating a course again

## Verify Your Role

Run this to check your current role:

```sql
SELECT id, name, role FROM profiles WHERE id = auth.uid();
```

Or check in browser console after login - the user object should have `role: 'admin'` or `role: 'creator'`.

