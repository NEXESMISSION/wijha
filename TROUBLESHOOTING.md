# Troubleshooting Guide

## Authentication Issues

### 400 Error on Login

If you're getting a `400` error when trying to login, check the following:

1. **User doesn't exist**: Make sure you've signed up first
   - Go to the Signup page
   - Create an account
   - Then try logging in

2. **Email confirmation required**: Supabase might require email confirmation
   - Go to Supabase Dashboard > Authentication > Settings
   - Check "Enable email confirmations"
   - If enabled, you'll need to confirm your email before logging in
   - Or disable it for development

3. **Password too short**: Password must be at least 6 characters

4. **Invalid credentials**: Double-check your email and password

### How to Disable Email Confirmation (Development)

1. Go to Supabase Dashboard
2. Navigate to **Authentication** > **Settings**
3. Under **Email Auth**, uncheck **"Enable email confirmations"**
4. Save changes

This allows immediate login after signup without email confirmation.

### Profile Not Found Error

If you see "Profile not found" errors:

1. Check that the SQL trigger `handle_new_user` is created
2. Verify the trigger is active in Supabase Dashboard > Database > Functions
3. Manually create a profile if needed:
   ```sql
   INSERT INTO profiles (id, name, role)
   VALUES ('user-uuid-here', 'User Name', 'student');
   ```

### Storage Upload Errors

If file uploads fail:

1. Verify storage buckets exist:
   - `course-videos` (public)
   - `payment-proofs` (private)

2. Check storage policies are set up correctly

3. Verify bucket permissions in Supabase Dashboard > Storage

### Common Supabase Configuration Issues

1. **RLS Policies**: Make sure Row Level Security is enabled and policies are correct
2. **CORS**: Check that your domain is allowed in Supabase settings
3. **API Keys**: Verify `.env` file has correct keys
4. **Database Schema**: Ensure all tables are created by running `schema.sql`

## React Router Warnings

The React Router warnings are informational and won't affect functionality. They're fixed by adding future flags to the Router component (already done).

## Favicon 404

The favicon 404 is harmless - a favicon has been added to prevent this warning.

## Still Having Issues?

1. Check browser console for detailed error messages
2. Check Supabase Dashboard > Logs for server-side errors
3. Verify all environment variables are set correctly
4. Ensure database schema is fully applied

