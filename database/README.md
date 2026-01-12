# Database Setup Instructions

## 1. Run the SQL Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `schema.sql`
4. Run the SQL script

This will create:
- All necessary tables
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic profile creation and timestamps

## 2. Create Storage Buckets

You need to create storage buckets for file uploads:

1. Go to Storage in Supabase dashboard
2. Create a new bucket named `course-videos` (public)
3. Create a new bucket named `payment-proofs` (private)

### Storage Policies

For `course-videos` (public bucket):
- Anyone can read
- Only authenticated users with creator role can upload

For `payment-proofs` (private bucket):
- Only the student who uploaded can read
- Only authenticated students can upload
- Admins and creators (for their courses) can read

## 3. Storage Policies SQL

Run this SQL in the Supabase SQL Editor:

```sql
-- Policy for course-videos bucket (public)
CREATE POLICY "Anyone can view course videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-videos');

CREATE POLICY "Creators can upload course videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-videos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'creator'
  )
);

-- Policy for payment-proofs bucket (private)
CREATE POLICY "Students can view their own payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs' AND
  EXISTS (
    SELECT 1 FROM enrollments
    JOIN payment_proofs ON payment_proofs.enrollment_id = enrollments.id
    WHERE enrollments.student_id = auth.uid()
  )
);

CREATE POLICY "Students can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'student'
  )
);
```

## 4. Verify Setup

After running the schema:
- Check that all tables are created
- Verify RLS is enabled on all tables
- Test creating a user account (profile should be created automatically)
- Test uploading files to storage buckets

## Notes

- The `handle_new_user` trigger automatically creates a profile when a user signs up
- All timestamps are automatically updated via triggers
- RLS policies ensure users can only access data they're allowed to see

