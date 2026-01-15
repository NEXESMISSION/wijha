-- ============================================
-- ADD VIDEO PLAYBACK EVENT TYPES TO AUDIT LOGS
-- Extends audit_logs table to track video security events
-- ============================================

-- Add new event types to the audit_logs event_type check constraint
-- Note: This requires dropping and recreating the constraint

-- First, drop the existing check constraint
ALTER TABLE audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;

-- Recreate the constraint with video event types
ALTER TABLE audit_logs
ADD CONSTRAINT audit_logs_event_type_check 
CHECK (event_type IN (
  'LOGIN_ATTEMPT',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'SESSION_INVALIDATED',
  'ROLE_CHANGED',
  'ADMIN_ACTION',
  'ENROLLMENT_APPROVED',
  'ENROLLMENT_REJECTED',
  'COURSE_APPROVED',
  'COURSE_REJECTED',
  'PAYOUT_APPROVED',
  'PAYOUT_REJECTED',
  'PROFILE_UPDATED',
  'PASSWORD_RESET',
  'ACCOUNT_DELETED',
  -- Video playback events
  'VIDEO_VIEW',
  'VIDEO_PLAY',
  'VIDEO_PAUSE',
  'VIDEO_COMPLETE',
  'VIDEO_ERROR',
  'VIDEO_DOWNLOAD_ATTEMPT',
  'VIDEO_TOKEN_GENERATED',
  'VIDEO_ACCESS_DENIED'
));

-- Create index for video events for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_video_events 
ON audit_logs(event_type, resource_type, created_at DESC) 
WHERE event_type LIKE 'VIDEO_%';

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
-- Note: The log_video_event function should be called from the application
-- when video events occur (view, play, pause, error, etc.)

