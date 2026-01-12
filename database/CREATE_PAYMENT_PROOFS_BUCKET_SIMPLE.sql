-- ============================================
-- QUICK SETUP: PAYMENT PROOFS STORAGE BUCKET
-- ============================================
-- 
-- IMPORTANT: You MUST create the bucket in Supabase Dashboard first!
--
-- Steps:
-- 1. Go to your Supabase Dashboard
-- 2. Click on "Storage" in the left sidebar
-- 3. Click "New bucket" button
-- 4. Bucket name: "payment-proofs" (exactly as shown)
-- 5. Make it PRIVATE (not public)
-- 6. Click "Create bucket"
-- 7. Then run this SQL script
-- ============================================

-- Policy: Allow authenticated students to upload payment proofs
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

-- Policy: Allow authenticated users to view payment proofs
-- (Simplified - allows students, creators, and admins)
DROP POLICY IF EXISTS "Authenticated users can view payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can view payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL
  );

-- Policy: Allow authenticated users to update payment proofs
DROP POLICY IF EXISTS "Authenticated users can update payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can update payment proofs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL
  );

-- Policy: Allow authenticated users to delete payment proofs
DROP POLICY IF EXISTS "Authenticated users can delete payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can delete payment proofs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-proofs' AND
    auth.uid() IS NOT NULL
  );

-- ============================================
-- DONE!
-- ============================================
-- After running this:
-- 1. The bucket "payment-proofs" should exist (created manually)
-- 2. These policies will allow authenticated users to manage files
-- 3. The bucket is private, so files won't be publicly accessible
-- ============================================

