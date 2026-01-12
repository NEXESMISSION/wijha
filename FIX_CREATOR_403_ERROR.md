# Fix: Creator 403 Error When Creating Course

## Problem
You're getting "new row violates row-level security policy for table 'courses'" when trying to create a course as a creator.

## Solution

### Step 1: Run This SQL Script

Copy and paste this **ENTIRE** script into Supabase SQL Editor:

```sql
-- Fix Creator Course Creation - 403 Error
-- User ID: a7b752ec-6f61-454e-becf-d8166ee60347

-- STEP 1: Verify user's profile and role
SELECT 
  p.id,
  p.name,
  p.role,
  au.email
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = 'a7b752ec-6f61-454e-becf-d8166ee60347';

-- STEP 2: Ensure user has 'creator' role
UPDATE profiles 
SET role = 'creator' 
WHERE id = 'a7b752ec-6f61-454e-becf-d8166ee60347';

-- STEP 3: Recreate the creator policy (drop and recreate)
DROP POLICY IF EXISTS "Creators can create courses" ON courses;
CREATE POLICY "Creators can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'creator'
    )
  );

-- STEP 4: Verify the policy was created
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'courses'
  AND policyname = 'Creators can create courses';
```

### Step 2: Refresh Browser

After running the SQL:
1. **Hard refresh** your browser (Ctrl+Shift+R)
2. **Log out and log back in**
3. Try creating a course again

## What This Fixes

✅ Ensures your profile has role 'creator'  
✅ Recreates the RLS policy for creators to create courses  
✅ Verifies the policy exists and is correct  

## Verify It Worked

After running the SQL, check:
1. The first SELECT should show `role: 'creator'`
2. The last SELECT should show the policy exists
3. Try creating a course - it should work now!

