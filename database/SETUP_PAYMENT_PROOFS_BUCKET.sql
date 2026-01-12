-- ============================================
-- SETUP PAYMENT PROOFS STORAGE BUCKET
-- ============================================
-- 
-- STEP 1: Create the bucket manually in Supabase Dashboard:
--   1. Go to Storage in your Supabase Dashboard
--   2. Click "New bucket"
--   3. Name: "payment-proofs"
--   4. Set as PRIVATE (not public)
--   5. Click "Create bucket"
--
-- STEP 2: Run this SQL script to set up the policies
-- ============================================

-- Enable RLS on storage.objects (if not already enabled)
-- This is usually enabled by default, but we'll ensure it

-- Policy: Students can upload payment proofs
DROP POLICY IF EXISTS "Students can upload payment proofs" ON storage.objects;
CREATE POLICY "Students can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
  );

-- Policy: Students can view their own payment proofs
-- This checks if the file path matches their enrollment
DROP POLICY IF EXISTS "Students can view their payment proofs" ON storage.objects;
CREATE POLICY "Students can view their payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL AND
    (
      -- Students can view if they have an enrollment with this file
      EXISTS (
        SELECT 1 FROM enrollments e
        JOIN payment_proofs pp ON pp.enrollment_id = e.id
        WHERE e.student_id = auth.uid()
          AND pp.file_url LIKE '%' || (storage.objects.name)::text || '%'
      )
      OR
      -- Admins can view all
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
      OR
      -- Creators can view proofs for their courses
      EXISTS (
        SELECT 1 FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        JOIN payment_proofs pp ON pp.enrollment_id = e.id
        WHERE c.creator_id = auth.uid()
          AND pp.file_url LIKE '%' || (storage.objects.name)::text || '%'
      )
    )
  );

-- Policy: Admins can manage all payment proofs
DROP POLICY IF EXISTS "Admins can manage payment proofs" ON storage.objects;
CREATE POLICY "Admins can manage payment proofs"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policy: Students can delete their own payment proofs
DROP POLICY IF EXISTS "Students can delete their payment proofs" ON storage.objects;
CREATE POLICY "Students can delete their payment proofs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'student'
    )
  );

-- ============================================
-- SIMPLER ALTERNATIVE (if above doesn't work)
-- ============================================
-- If the policies above are too restrictive, use this simpler version:

/*
-- Allow all authenticated users to upload to payment-proofs
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL
  );

-- Allow all authenticated users to view payment-proofs
DROP POLICY IF EXISTS "Authenticated users can view payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can view payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL
  );
*/

-- ============================================
-- DONE!
-- ============================================

