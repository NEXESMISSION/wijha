# Debugging Login/Signup Issues

## Check These First

1. **Open Browser Console** (F12) and check for errors
2. **Check Network Tab** - See if requests are being made to Supabase
3. **Verify Environment Variables** - Make sure `.env` file exists and has correct values

## Common Issues

### Buttons Don't Respond

If clicking the buttons does nothing:

1. Check browser console for JavaScript errors
2. Verify the form is not being prevented from submitting
3. Check if there are any CSS issues (z-index, pointer-events)

### 422 Error on Signup

This means the request is invalid. Common causes:
- Email already exists
- Password too short (must be 6+ characters)
- Invalid email format
- Database trigger failing

**Solution**: Run `database/fix-signup.sql` in Supabase SQL Editor

### 400 Error on Login

This means invalid credentials:
- Wrong email/password
- User doesn't exist
- Email not confirmed (if email confirmation is enabled)

**Solution**: 
- Make sure you've signed up first
- Disable email confirmation in Supabase Dashboard > Authentication > Settings

### Environment Variables Missing

Check that `.env` file exists and contains:
```
VITE_SUPABASE_URL=https://mxsydpljfseanvwxsrgj.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

## Testing Steps

1. **Test Button Click**:
   - Open browser console
   - Click Login/Signup button
   - You should see "Login button clicked" or "Signup button clicked" in console

2. **Test Form Submission**:
   - Fill in the form
   - Click submit
   - Check console for "Attempting login..." or "Attempting signup..."
   - Check Network tab for API requests

3. **Test Supabase Connection**:
   - Open browser console
   - Type: `localStorage.getItem('sb-mxsydpljfseanvwxsrgj-auth-token')`
   - Should return token after successful login

## Quick Fixes

### If buttons don't work at all:

1. Clear browser cache
2. Restart dev server: `npm run dev`
3. Check for JavaScript errors in console
4. Verify React is loading correctly

### If form submits but nothing happens:

1. Check Network tab for failed requests
2. Check console for error messages
3. Verify Supabase URL and keys are correct
4. Check Supabase Dashboard for any service issues

## Still Not Working?

1. Check `src/lib/supabase.js` - verify it's exporting correctly
2. Check `src/context/AuthContext.jsx` - verify login/signup functions exist
3. Check browser console for any React errors
4. Verify all dependencies are installed: `npm install`

