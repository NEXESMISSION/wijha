-- ============================================
-- COMPLETE DATABASE RESET
-- Course Marketplace MVP - Full Database Reset & Setup
-- ⚠️ WARNING: This will DELETE ALL DATA and recreate everything
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: DROP ALL EXISTING OBJECTS
-- ============================================

-- Drop all triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
DROP TRIGGER IF EXISTS update_modules_updated_at ON modules;
DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
DROP TRIGGER IF EXISTS update_enrollments_updated_at ON enrollments;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS is_user_creator(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_user_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_user_student(UUID) CASCADE;

-- Drop all policies (must drop before dropping tables)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;

DROP POLICY IF EXISTS "Anyone can view published courses" ON courses;
DROP POLICY IF EXISTS "Creators can view their own courses" ON courses;
DROP POLICY IF EXISTS "Admins can view all courses" ON courses;
DROP POLICY IF EXISTS "Creators can create courses" ON courses;
DROP POLICY IF EXISTS "Admins can create courses" ON courses;
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

-- Drop all tables (in reverse order of dependencies)
DROP TABLE IF EXISTS payout_requests CASCADE;
DROP TABLE IF EXISTS payment_proofs CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- STEP 2: CREATE EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 3: CREATE TABLES
-- ============================================

-- Profiles table (extends Supabase Auth users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'creator', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Courses table
CREATE TABLE courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'suspended')),
  tags TEXT[],
  trailer_video_url TEXT,
  approved_by_admin_id UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Modules table
CREATE TABLE modules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Lessons table
CREATE TABLE lessons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  is_trailer BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enrollments table
CREATE TABLE enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by_admin_id UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, course_id)
);

-- Payment Proofs table
CREATE TABLE payment_proofs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT,
  text_proof TEXT,
  payment_method TEXT NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Payout Requests table
CREATE TABLE payout_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  admin_note TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by_admin_id UUID REFERENCES profiles(id)
);

-- ============================================
-- STEP 4: CREATE INDEXES
-- ============================================

CREATE INDEX idx_courses_creator_id ON courses(creator_id);
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_modules_course_id ON modules(course_id);
CREATE INDEX idx_lessons_module_id ON lessons(module_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_payment_proofs_enrollment_id ON payment_proofs(enrollment_id);
CREATE INDEX idx_payout_requests_creator_id ON payout_requests(creator_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);

-- ============================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: CREATE HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================

-- Function to check if user is creator (bypasses RLS)
CREATE FUNCTION is_user_creator(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'creator'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin (bypasses RLS)
CREATE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is student (bypasses RLS)
CREATE FUNCTION is_user_student(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'student'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- STEP 7: CREATE RLS POLICIES - PROFILES
-- ============================================

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- ============================================
-- STEP 8: CREATE RLS POLICIES - COURSES
-- ============================================

CREATE POLICY "Anyone can view published courses"
  ON courses FOR SELECT
  USING (status = 'published');

CREATE POLICY "Creators can view their own courses"
  ON courses FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can view all courses"
  ON courses FOR SELECT
  USING (is_user_admin(auth.uid()));

CREATE POLICY "Creators can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = creator_id AND
    is_user_creator(auth.uid())
  );

CREATE POLICY "Admins can create courses"
  ON courses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    is_user_admin(auth.uid())
  );

CREATE POLICY "Creators can update their own courses"
  ON courses FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can update any course"
  ON courses FOR UPDATE
  USING (is_user_admin(auth.uid()));

-- ============================================
-- STEP 9: CREATE RLS POLICIES - MODULES
-- ============================================

CREATE POLICY "Anyone can view modules of published courses"
  ON modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = modules.course_id AND courses.status = 'published'
    )
  );

CREATE POLICY "Creators can manage modules of their courses"
  ON modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = modules.course_id AND courses.creator_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all modules"
  ON modules FOR ALL
  USING (is_user_admin(auth.uid()));

-- ============================================
-- STEP 10: CREATE RLS POLICIES - LESSONS
-- ============================================

CREATE POLICY "Anyone can view lessons of published courses"
  ON lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id AND courses.status = 'published'
    )
  );

CREATE POLICY "Anyone can view trailer lessons"
  ON lessons FOR SELECT
  USING (is_trailer = true);

CREATE POLICY "Creators can manage lessons of their courses"
  ON lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id AND courses.creator_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all lessons"
  ON lessons FOR ALL
  USING (is_user_admin(auth.uid()));

-- ============================================
-- STEP 11: CREATE RLS POLICIES - ENROLLMENTS
-- ============================================

CREATE POLICY "Students can view their own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Creators can view enrollments for their courses"
  ON enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = enrollments.course_id AND courses.creator_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all enrollments"
  ON enrollments FOR SELECT
  USING (is_user_admin(auth.uid()));

CREATE POLICY "Students can create enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (
    auth.uid() = student_id AND
    is_user_student(auth.uid())
  );

CREATE POLICY "Admins can update enrollments"
  ON enrollments FOR UPDATE
  USING (is_user_admin(auth.uid()));

-- ============================================
-- STEP 12: CREATE RLS POLICIES - PAYMENT PROOFS
-- ============================================

CREATE POLICY "Students can view their own payment proofs"
  ON payment_proofs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.id = payment_proofs.enrollment_id AND enrollments.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can create payment proofs for their enrollments"
  ON payment_proofs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.id = payment_proofs.enrollment_id AND enrollments.student_id = auth.uid()
    )
  );

CREATE POLICY "Creators can view payment proofs for their courses"
  ON payment_proofs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN courses ON courses.id = enrollments.course_id
      WHERE enrollments.id = payment_proofs.enrollment_id AND courses.creator_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payment proofs"
  ON payment_proofs FOR SELECT
  USING (is_user_admin(auth.uid()));

-- ============================================
-- STEP 13: CREATE RLS POLICIES - PAYOUT REQUESTS
-- ============================================

CREATE POLICY "Creators can view their own payout requests"
  ON payout_requests FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can create payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id AND
    is_user_creator(auth.uid())
  );

CREATE POLICY "Admins can view all payout requests"
  ON payout_requests FOR SELECT
  USING (is_user_admin(auth.uid()));

CREATE POLICY "Admins can update payout requests"
  ON payout_requests FOR UPDATE
  USING (is_user_admin(auth.uid()));

-- ============================================
-- STEP 14: CREATE TRIGGERS
-- ============================================

-- Function to automatically create profile on user signup
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 15: VERIFICATION
-- ============================================

-- Check all tables exist
SELECT 
  'Tables' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'courses', 'modules', 'lessons', 'enrollments', 'payment_proofs', 'payout_requests')
ORDER BY tablename;

-- Check all policies exist
SELECT 
  'Policies' as check_type,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Check helper functions exist
SELECT 
  'Functions' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_user_creator', 'is_user_admin', 'is_user_student', 'handle_new_user', 'update_updated_at_column')
ORDER BY routine_name;

-- ============================================
-- DONE! Database is completely reset and ready
-- ============================================
-- ✅ All old data deleted
-- ✅ All tables recreated
-- ✅ All indexes created
-- ✅ RLS enabled on all tables
-- ✅ All policies created (using SECURITY DEFINER functions)
-- ✅ Triggers for auto-creating profiles
-- ✅ Triggers for auto-updating timestamps
-- ✅ Helper functions for role checking
-- ============================================

