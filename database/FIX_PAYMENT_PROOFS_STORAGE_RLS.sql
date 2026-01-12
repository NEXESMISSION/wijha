-- ============================================
-- FIX PAYMENT PROOFS STORAGE RLS POLICY
-- ============================================
-- This fixes the "new row violates row-level security policy" error
-- when uploading payment proofs

-- Policy: Allow authenticated students to upload payment proofs
-- This allows uploads to the root of the bucket (no folder prefix)
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

-- Policy: Allow students to view their uploaded payment proofs
DROP POLICY IF EXISTS "Students can view their payment proofs" ON storage.objects;
CREATE POLICY "Students can view their payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL AND
    (
      -- Students can view files they uploaded
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'student'
      ) OR
      -- Admins can view all
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      ) OR
      -- Creators can view payment proofs for their courses
      EXISTS (
        SELECT 1 FROM payment_proofs
        JOIN enrollments ON enrollments.id = payment_proofs.enrollment_id
        JOIN courses ON courses.id = enrollments.course_id
        WHERE courses.creator_id = auth.uid()
        AND (storage.objects.name = payment_proofs.file_url OR storage.objects.name LIKE '%' || payment_proofs.file_url || '%')
      )
    )
  );

