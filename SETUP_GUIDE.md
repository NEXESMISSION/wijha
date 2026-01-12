# Complete Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Environment Setup

The `.env` file should already be created with your Supabase credentials. If not, run:

```bash
npm run create-env
```

Verify the `.env` file contains:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Database Setup

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `database/schema.sql`
4. Click **Run** to execute the SQL

This creates:
- All database tables (profiles, courses, modules, lessons, enrollments, payment_proofs, payout_requests)
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic profile creation and timestamp updates

## Step 4: Storage Setup

1. Go to **Storage** in Supabase dashboard
2. Create two buckets:

### Bucket 1: `course-videos` (Public)
- Make it public
- This stores course videos and trailers

### Bucket 2: `payment-proofs` (Private)
- Keep it private
- This stores student payment proof images

3. Go to **SQL Editor** and run the storage policies from `database/README.md`

## Step 5: Test the Application

1. Start the development server:
```bash
npm run dev
```

2. Open `http://localhost:3000` in your browser

3. Create your first account:
   - Click "Sign up"
   - Choose a role (Student, Creator, or Admin)
   - Fill in your details
   - You'll be automatically logged in

## Step 6: Create Admin User (Optional)

To create an admin user, you can either:

1. **Via Supabase Dashboard:**
   - Go to Authentication > Users
   - Create a user manually
   - Go to Table Editor > profiles
   - Find the user and change their role to 'admin'

2. **Via SQL:**
```sql
-- First create the auth user, then update profile
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-admin@email.com';
```

## Features Now Available

✅ **Real-time data** from Supabase  
✅ **Authentication** with Supabase Auth  
✅ **File uploads** to Supabase Storage  
✅ **Row Level Security** protecting data  
✅ **Automatic profile creation** on signup  
✅ **All CRUD operations** working with real database  

## Troubleshooting

### "Missing Supabase environment variables"
- Check that `.env` file exists and has all required variables
- Restart the dev server after creating/updating `.env`

### "Permission denied" errors
- Verify RLS policies are set up correctly
- Check that storage buckets exist and policies are applied
- Ensure user is authenticated

### "Profile not found"
- The trigger should create profiles automatically
- If not, check the `handle_new_user` function in the schema

### Storage upload errors
- Verify storage buckets are created
- Check bucket policies allow uploads
- Ensure bucket names match: `course-videos` and `payment-proofs`

## Next Steps

1. **Add more features:**
   - Video streaming integration (Bunny Stream)
   - Email notifications
   - Search functionality
   - Course ratings and reviews

2. **Production deployment:**
   - Build the app: `npm run build`
   - Deploy to Vercel, Netlify, or your preferred platform
   - Update environment variables in production

3. **Security:**
   - Review and test all RLS policies
   - Set up proper CORS rules
   - Configure rate limiting
   - Add input validation

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check Supabase logs in the dashboard
3. Verify all SQL scripts ran successfully
4. Ensure all environment variables are set correctly

