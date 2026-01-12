# Fix for Signup 422 Error

## The Problem

The 422 error occurs because the database trigger that creates profiles might be blocked by Row Level Security (RLS) policies.

## Solution

Run the SQL in `database/fix-signup.sql` in your Supabase SQL Editor. This will:

1. Add a policy that allows the trigger function to insert profiles
2. Update the trigger function to handle errors gracefully
3. Grant necessary permissions

## Quick Fix Steps

1. Go to Supabase Dashboard > SQL Editor
2. Copy and paste the contents of `database/fix-signup.sql`
3. Click "Run"
4. Try signing up again

## Alternative: Disable Email Confirmation

If you're still having issues, you can disable email confirmation for development:

1. Go to Supabase Dashboard > Authentication > Settings
2. Under "Email Auth", uncheck "Enable email confirmations"
3. Save changes

## Manual Profile Creation (If Trigger Fails)

If the trigger still doesn't work, you can manually create profiles:

```sql
-- After signing up, find your user ID in Authentication > Users
-- Then run:
INSERT INTO profiles (id, name, role)
VALUES ('your-user-id-here', 'Your Name', 'student')
ON CONFLICT (id) DO NOTHING;
```

## Verify the Fix

After running the fix SQL:

1. Check that the trigger exists:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

2. Check that the function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
   ```

3. Try signing up with a new account
4. Check if profile was created:
   ```sql
   SELECT * FROM profiles ORDER BY created_at DESC LIMIT 1;
   ```

## Common Issues

### Issue: "permission denied for table profiles"
- Solution: Run the fix-signup.sql script

### Issue: "duplicate key value violates unique constraint"
- Solution: The profile already exists, try logging in instead

### Issue: "role does not exist"
- Solution: Make sure you're selecting a valid role (student, creator, or admin)

