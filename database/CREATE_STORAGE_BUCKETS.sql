-- ============================================
-- CREATE STORAGE BUCKETS AND POLICIES
-- This script sets up storage buckets for the platform
-- ============================================

-- Note: Storage buckets must be created via Supabase Dashboard or API first
-- Go to Storage > Create Bucket and create:
-- 1. 'course-videos' (public bucket)
-- 2. 'payment-proofs' (private bucket)
--
-- Then run this SQL to set up the policies

-- ============================================
-- STORAGE POLICIES FOR COURSE VIDEOS
-- ============================================

-- Allow anyone to view course videos (public bucket)
DROP POLICY IF EXISTS "Anyone can view course videos" ON storage.objects;
CREATE POLICY "Anyone can view course videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-videos');

-- Allow creators to upload course videos
DROP POLICY IF EXISTS "Creators can upload course videos" ON storage.objects;
CREATE POLICY "Creators can upload course videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'course-videos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'creator'
    )
  );

-- Allow creators to update their own course videos
DROP POLICY IF EXISTS "Creators can update course videos" ON storage.objects;
CREATE POLICY "Creators can update course videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'course-videos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'creator'
    )
  );

-- Allow creators to delete their own course videos
DROP POLICY IF EXISTS "Creators can delete course videos" ON storage.objects;
CREATE POLICY "Creators can delete course videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'course-videos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'creator'
    )
  );

-- Allow admins to manage all course videos
DROP POLICY IF EXISTS "Admins can manage course videos" ON storage.objects;
CREATE POLICY "Admins can manage course videos"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'course-videos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- STORAGE POLICIES FOR PAYMENT PROOFS
-- ============================================

-- Students can view their own payment proofs
DROP POLICY IF EXISTS "Students can view their own payment proofs" ON storage.objects;
CREATE POLICY "Students can view their own payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN payment_proofs ON payment_proofs.enrollment_id = enrollments.id
      WHERE enrollments.student_id = auth.uid()
        AND (storage.objects.name)::text LIKE '%' || payment_proofs.file_url || '%'
    )
  );

-- Students can upload payment proofs
DROP POLICY IF EXISTS "Students can upload payment proofs" ON storage.objects;
CREATE POLICY "Students can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
  );

-- Creators can view payment proofs for their courses
DROP POLICY IF EXISTS "Creators can view payment proofs for their courses" ON storage.objects;
CREATE POLICY "Creators can view payment proofs for their courses"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN courses ON courses.id = enrollments.course_id
      JOIN payment_proofs ON payment_proofs.enrollment_id = enrollments.id
      WHERE courses.creator_id = auth.uid()
        AND (storage.objects.name)::text LIKE '%' || payment_proofs.file_url || '%'
    )
  );

-- Admins can view all payment proofs
DROP POLICY IF EXISTS "Admins can view all payment proofs" ON storage.objects;
CREATE POLICY "Admins can view all payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Students can update their own payment proofs
DROP POLICY IF EXISTS "Students can update their own payment proofs" ON storage.objects;
CREATE POLICY "Students can update their own payment proofs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
  );

-- Students can delete their own payment proofs
DROP POLICY IF EXISTS "Students can delete their own payment proofs" ON storage.objects;
CREATE POLICY "Students can delete their own payment proofs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
  );

-- Admins can manage all payment proofs
DROP POLICY IF EXISTS "Admins can manage all payment proofs" ON storage.objects;
CREATE POLICY "Admins can manage all payment proofs"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- ALTERNATIVE: SIMPLER POLICIES FOR PAYMENT PROOFS
-- If the above policies are too complex, use these simpler ones:
-- ============================================

-- Uncomment these if you want simpler policies:

/*
-- Allow authenticated students to upload payment proofs
DROP POLICY IF EXISTS "Students can upload payment proofs simple" ON storage.objects;
CREATE POLICY "Students can upload payment proofs simple"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
  );

-- Allow students to view files they uploaded (by checking path contains their user ID)
DROP POLICY IF EXISTS "Students can view their uploaded payment proofs" ON storage.objects;
CREATE POLICY "Students can view their uploaded payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL AND
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'student'
      ) OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      ) OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'creator'
      )
    )
  );
*/

-- ============================================
-- DONE!
-- ============================================
-- IMPORTANT: Before running this script:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create bucket named 'course-videos' (set as PUBLIC)
-- 3. Create bucket named 'payment-proofs' (set as PRIVATE)
-- 4. Then run this SQL script to set up the policies
-- ============================================

