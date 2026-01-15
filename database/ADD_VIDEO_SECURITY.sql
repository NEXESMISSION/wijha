-- Video Security Tables and Functions
-- This script adds comprehensive video access logging and security tracking

-- =============================================
-- 1. Video Events Table (for detailed video playback tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS video_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_video_events_student ON video_events(student_id);
CREATE INDEX IF NOT EXISTS idx_video_events_lesson ON video_events(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_events_type ON video_events(event_type);
CREATE INDEX IF NOT EXISTS idx_video_events_created ON video_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_device ON video_events(device_id);

-- Enable RLS
ALTER TABLE video_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own video events" ON video_events;
DROP POLICY IF EXISTS "Users can insert their own video events" ON video_events;
DROP POLICY IF EXISTS "Admins can view all video events" ON video_events;

-- RLS Policies
-- Users can view their own video events
CREATE POLICY "Users can view their own video events"
  ON video_events FOR SELECT
  USING (auth.uid() = student_id);

-- Users can insert their own video events
CREATE POLICY "Users can insert their own video events"
  ON video_events FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Admins can view all video events
CREATE POLICY "Admins can view all video events"
  ON video_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =============================================
-- 2. Video Access Tokens Table (for tracking generated URLs)
-- =============================================
CREATE TABLE IF NOT EXISTS video_access_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  watermark_code TEXT NOT NULL,
  tracking_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_access_tokens_user ON video_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_video_access_tokens_lesson ON video_access_tokens(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_access_tokens_expires ON video_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_video_access_tokens_tracking ON video_access_tokens(tracking_code);

-- Enable RLS
ALTER TABLE video_access_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own tokens" ON video_access_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON video_access_tokens;
DROP POLICY IF EXISTS "Admins can view all tokens" ON video_access_tokens;

-- RLS Policies
CREATE POLICY "Users can view their own tokens"
  ON video_access_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON video_access_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tokens"
  ON video_access_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =============================================
-- 3. Security Alerts Table (for suspicious activity)
-- =============================================
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  details JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all security alerts" ON security_alerts;
DROP POLICY IF EXISTS "System can insert security alerts" ON security_alerts;
DROP POLICY IF EXISTS "Admins can update security alerts" ON security_alerts;

-- RLS Policies
CREATE POLICY "Admins can view all security alerts"
  ON security_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow service role to insert alerts
CREATE POLICY "System can insert security alerts"
  ON security_alerts FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway

CREATE POLICY "Admins can update security alerts"
  ON security_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =============================================
-- 4. Function to log video events
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
  
  -- Check for suspicious activity patterns
  -- Multiple devices watching same content simultaneously
  IF p_event_type = 'VIDEO_PLAY' THEN
    PERFORM check_concurrent_playback(p_student_id, p_lesson_id, p_device_id);
  END IF;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. Function to check concurrent playback (anti-sharing)
-- =============================================
CREATE OR REPLACE FUNCTION check_concurrent_playback(
  p_student_id UUID,
  p_lesson_id UUID,
  p_current_device_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_concurrent_count INTEGER;
  v_threshold INTEGER := 2; -- Max devices that can play simultaneously
BEGIN
  -- Count active playback sessions in the last 5 minutes from different devices
  SELECT COUNT(DISTINCT device_id) INTO v_concurrent_count
  FROM video_events
  WHERE student_id = p_student_id
    AND event_type = 'VIDEO_PLAY'
    AND created_at > NOW() - INTERVAL '5 minutes'
    AND device_id != p_current_device_id;
  
  -- If too many concurrent sessions, create security alert
  IF v_concurrent_count >= v_threshold THEN
    INSERT INTO security_alerts (
      user_id,
      alert_type,
      severity,
      description,
      details
    )
    VALUES (
      p_student_id,
      'CONCURRENT_PLAYBACK',
      'high',
      'Multiple devices playing video simultaneously',
      jsonb_build_object(
        'lesson_id', p_lesson_id,
        'concurrent_devices', v_concurrent_count + 1,
        'current_device', p_current_device_id,
        'threshold', v_threshold
      )
    );
    
    RETURN TRUE; -- Alert created
  END IF;
  
  RETURN FALSE; -- No alert needed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. Function to get video analytics for a course
-- =============================================
CREATE OR REPLACE FUNCTION get_video_analytics(
  p_course_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  lesson_id UUID,
  lesson_title TEXT,
  total_views BIGINT,
  unique_viewers BIGINT,
  total_play_time_seconds BIGINT,
  completion_rate NUMERIC,
  avg_watch_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id AS lesson_id,
    l.title AS lesson_title,
    COUNT(*) FILTER (WHERE ve.event_type = 'VIDEO_VIEW') AS total_views,
    COUNT(DISTINCT ve.student_id) AS unique_viewers,
    COALESCE(SUM((ve.event_data->>'totalPlaybackTime')::INTEGER) FILTER (WHERE ve.event_type IN ('VIDEO_PAUSE', 'VIDEO_COMPLETED')), 0) AS total_play_time_seconds,
    ROUND(
      (COUNT(*) FILTER (WHERE ve.event_type = 'VIDEO_COMPLETED')::NUMERIC / 
       NULLIF(COUNT(DISTINCT ve.student_id), 0) * 100), 2
    ) AS completion_rate,
    ROUND(
      AVG(
        CASE WHEN ve.event_data->>'videoDuration' IS NOT NULL AND (ve.event_data->>'videoDuration')::NUMERIC > 0
        THEN (ve.event_data->>'totalPlaybackTime')::NUMERIC / (ve.event_data->>'videoDuration')::NUMERIC * 100
        ELSE NULL END
      ) FILTER (WHERE ve.event_type = 'VIDEO_COMPLETED'), 2
    ) AS avg_watch_percentage
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  LEFT JOIN video_events ve ON ve.lesson_id = l.id 
    AND ve.created_at BETWEEN p_start_date AND p_end_date
  WHERE m.course_id = p_course_id
  GROUP BY l.id, l.title
  ORDER BY total_views DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. Grant permissions
-- =============================================
GRANT EXECUTE ON FUNCTION log_video_event(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION check_concurrent_playback(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_video_analytics(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- =============================================
-- 8. Create view for admin dashboard
-- =============================================
CREATE OR REPLACE VIEW video_security_summary AS
SELECT 
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS total_events,
  COUNT(DISTINCT student_id) AS unique_users,
  COUNT(*) FILTER (WHERE event_type = 'VIDEO_VIEW') AS views,
  COUNT(*) FILTER (WHERE event_type = 'VIDEO_PLAY') AS plays,
  COUNT(*) FILTER (WHERE event_type = 'VIDEO_COMPLETED') AS completions,
  COUNT(*) FILTER (WHERE event_type = 'SCREENSHOT_ATTEMPT') AS screenshot_attempts,
  COUNT(*) FILTER (WHERE event_type = 'DEVTOOLS_OPEN') AS devtools_opens,
  COUNT(DISTINCT device_id) AS unique_devices
FROM video_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Grant access to view
GRANT SELECT ON video_security_summary TO authenticated;

COMMENT ON TABLE video_events IS 'Tracks all video playback events for security and analytics';
COMMENT ON TABLE video_access_tokens IS 'Tracks generated video access tokens with watermark codes';
COMMENT ON TABLE security_alerts IS 'Security alerts for suspicious video access patterns';
COMMENT ON VIEW video_security_summary IS 'Daily summary of video security events for admin dashboard';

