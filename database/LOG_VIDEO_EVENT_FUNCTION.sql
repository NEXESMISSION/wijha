-- ============================================
-- LOG VIDEO EVENT DATABASE FUNCTION
-- This is a PostgreSQL RPC function (not an Edge Function)
-- Run this in Supabase SQL Editor
-- ============================================

-- Function to log video playback events
CREATE OR REPLACE FUNCTION log_video_event(
  p_student_id UUID,
  p_lesson_id UUID,
  p_device_id TEXT,
  p_event_type TEXT DEFAULT 'VIDEO_VIEW'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_course_id UUID;
BEGIN
  -- Get course_id from lesson
  SELECT course_id INTO v_course_id
  FROM modules m
  JOIN lessons l ON l.module_id = m.id
  WHERE l.id = p_lesson_id;
  
  -- Insert audit log entry
  INSERT INTO audit_logs (
    user_id,
    event_type,
    resource_type,
    resource_id,
    details,
    user_agent
  )
  VALUES (
    p_student_id,
    p_event_type,
    'lesson',
    p_lesson_id,
    jsonb_build_object(
      'lesson_id', p_lesson_id,
      'course_id', v_course_id,
      'device_id', p_device_id,
      'event_type', p_event_type
    ),
    p_device_id
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_video_event(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- DONE!
-- ============================================
-- Usage: Call this function from your application:
-- SELECT log_video_event(
--   'student-uuid'::UUID,
--   'lesson-uuid'::UUID,
--   'device-id',
--   'VIDEO_VIEW'
-- );

