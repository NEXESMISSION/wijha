# Fix: Show Admin Dashboard Instead of Creator Dashboard

## Problem
You're logged in as admin but still seeing the creator dashboard. This is because your profile role in the database is still set to 'creator' instead of 'admin'.

## Quick Fix

### Step 1: Update Your Role in Database

Run this SQL in **Supabase SQL Editor** (replace with your email):

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

### Step 2: Refresh Your Browser

After running the SQL:
1. **Hard refresh** your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Or **log out and log back in**

### Step 3: Verify

You should now see:
- Navigation shows: "Dashboard | All Courses" (not "Create Course")
- Dashboard shows: "Super Admin Dashboard" with tabs for Courses, Enrollments, Payout Requests
- Your name shows as "(admin)" instead of "(creator)"

## Check Your Current Role

Run this to see your current role:

```sql
SELECT 
  au.email,
  p.name,
  p.role
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'your-email@example.com';
```

## Find Your Email

If you don't know your email, run this to see all users:

```sql
SELECT 
  au.email,
  p.name,
  p.role
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY p.role, au.email;
```

## Admin Dashboard Features (According to Spec)

Once you're admin, you'll see:

1. **Courses Tab**: Approve/reject courses (pending courses)
2. **Enrollments Tab**: Approve/reject student enrollments with payment proofs
3. **Payout Requests Tab**: Approve/reject creator payout requests

All tabs show pending items that need your approval.

