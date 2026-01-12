# FINAL FIX: Profile Not Found + 403 Error

## The Problem
1. Profile doesn't exist in database
2. RLS policies block course creation without a profile
3. Profile can't be created automatically due to RLS

## The Solution

### Step 1: Run This SQL Script

Copy and paste this **ENTIRE** script into Supabase SQL Editor and run it:

```sql
-- ============================================
-- COMPLETE FIX: Create Profile + Fix RLS + Add Admin Policy
-- ============================================

-- STEP 1: Create profile (using service role bypass)
-- This uses a function that bypasses RLS
CREATE OR REPLACE FUNCTION create_admin_profile()
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    'dc8603a2-1933-4688-b0f0-17ff01db8aee',
    'Admin User',
    'admin'
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', name = COALESCE(profiles.name, 'Admin User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function
SELECT create_admin_profile();

-- Drop the function (cleanup)
DROP FUNCTION create_admin_profile();

-- STEP 2: Ensure RLS policy exists for viewing own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- STEP 3: Add admin policy for creating courses
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- STEP 4: Verify
SELECT 
  p.id,
  p.name,
  p.role,
  au.email
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.id = 'dc8603a2-1933-4688-b0f0-17ff01db8aee';
```

### Step 2: Refresh Browser

After running the SQL:
1. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Log out completely**
3. **Log back in**

### Step 3: Verify

Check browser console - you should see:
- ✅ "Profile data: found" (not "not found")
- ✅ No more 403 errors
- ✅ Can create courses successfully

## Alternative: If SQL Function Doesn't Work

If the function approach doesn't work, try this simpler approach:

1. **Temporarily disable RLS** (in Supabase Dashboard → Table Editor → profiles → Settings)
2. **Insert the profile manually**:
   ```sql
   INSERT INTO profiles (id, name, role)
   VALUES ('dc8603a2-1933-4688-b0f0-17ff01db8aee', 'Admin User', 'admin');
   ```
3. **Re-enable RLS**
4. **Run the policy fixes** from Step 1 above

## What This Fixes

✅ Creates your profile with admin role  
✅ Fixes RLS policy so you can view your own profile  
✅ Adds admin policy so admins can create courses  
✅ Verifies everything is set up correctly  

After this, you should be able to:
- See your profile loaded
- See "(admin)" in navigation
- See Super Admin Dashboard
- Create courses without 403 errors

