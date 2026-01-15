-- Fix RLS policies for payout_requests and profiles tables
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. Ensure payout_requests table has RLS enabled
-- =============================================
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Creators can view their own payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Creators can insert their own payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can view all payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can update payout requests" ON payout_requests;

-- Creators can view their own payout requests
CREATE POLICY "Creators can view their own payout requests"
  ON payout_requests FOR SELECT
  USING (auth.uid() = creator_id);

-- Creators can create their own payout requests
CREATE POLICY "Creators can insert their own payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Admins can view all payout requests
CREATE POLICY "Admins can view all payout requests"
  ON payout_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can update any payout request
CREATE POLICY "Admins can update payout requests"
  ON payout_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =============================================
-- 2. Fix profiles table RLS policies
-- =============================================
-- Ensure profiles table has proper RLS policies

-- Drop and recreate the admin view all profiles policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    -- User viewing their own profile
    auth.uid() = id
    OR
    -- User is an admin
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
    OR
    -- Public profiles (for course creators, comments, etc.)
    TRUE
  );

-- =============================================
-- 3. Create helper function for admin check
-- =============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- =============================================
-- 4. Fix the video_events table if it doesn't exist
-- =============================================
DO $$
BEGIN
  -- Check if video_events table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'video_events') THEN
    CREATE TABLE video_events (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      lesson_id UUID NOT NULL,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );
    
    -- Enable RLS
    ALTER TABLE video_events ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Users can view their own video events"
      ON video_events FOR SELECT
      USING (auth.uid() = student_id);
    
    CREATE POLICY "Users can insert their own video events"
      ON video_events FOR INSERT
      WITH CHECK (auth.uid() = student_id);
  END IF;
END $$;

-- =============================================
-- 5. Create log_video_event function if not exists
-- =============================================
CREATE OR REPLACE FUNCTION log_video_event(
  p_student_id UUID,
  p_lesson_id UUID,
  p_device_id TEXT,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO video_events (
    student_id,
    lesson_id,
    device_id,
    event_type,
    event_data
  )
  VALUES (
    p_student_id,
    p_lesson_id,
    p_device_id,
    p_event_type,
    p_event_data
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail
    RAISE WARNING 'Error logging video event: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_video_event(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;

-- =============================================
-- Success message
-- =============================================
DO $$
BEGIN
  RAISE NOTICE 'RLS policies fixed successfully!';
END $$;

