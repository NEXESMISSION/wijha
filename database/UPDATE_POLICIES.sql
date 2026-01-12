-- Quick fix: Drop and recreate all policies
-- Run this if you're getting "already exists" errors

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;

DROP POLICY IF EXISTS "Anyone can view published courses" ON courses;
DROP POLICY IF EXISTS "Creators can view their own courses" ON courses;
DROP POLICY IF EXISTS "Admins can view all courses" ON courses;
DROP POLICY IF EXISTS "Creators can create courses" ON courses;
DROP POLICY IF EXISTS "Creators can update their own courses" ON courses;
DROP POLICY IF EXISTS "Admins can update any course" ON courses;

DROP POLICY IF EXISTS "Anyone can view modules of published courses" ON modules;
DROP POLICY IF EXISTS "Creators can manage modules of their courses" ON modules;
DROP POLICY IF EXISTS "Admins can manage all modules" ON modules;

DROP POLICY IF EXISTS "Anyone can view lessons of published courses" ON lessons;
DROP POLICY IF EXISTS "Anyone can view trailer lessons" ON lessons;
DROP POLICY IF EXISTS "Creators can manage lessons of their courses" ON lessons;
DROP POLICY IF EXISTS "Admins can manage all lessons" ON lessons;

DROP POLICY IF EXISTS "Students can view their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Creators can view enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Admins can view all enrollments" ON enrollments;
DROP POLICY IF EXISTS "Students can create enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins can update enrollments" ON enrollments;

DROP POLICY IF EXISTS "Students can view their own payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Students can create payment proofs for their enrollments" ON payment_proofs;
DROP POLICY IF EXISTS "Creators can view payment proofs for their courses" ON payment_proofs;
DROP POLICY IF EXISTS "Admins can view all payment proofs" ON payment_proofs;

DROP POLICY IF EXISTS "Creators can view their own payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Creators can create payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can view all payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can update payout requests" ON payout_requests;

-- Now run the rest of schema.sql from line 113 onwards (the CREATE POLICY statements)

