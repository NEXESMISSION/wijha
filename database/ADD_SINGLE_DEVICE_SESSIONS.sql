-- Single-Device Session Enforcement System
-- This migration adds support for enforcing one active session per user

-- Create user_sessions table to track active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  invalidated_at TIMESTAMP WITH TIME ZONE,
  invalidation_reason TEXT
);

-- Create unique partial index to ensure only one active session per user
-- This allows multiple inactive sessions but only one active session per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_one_active_per_user 
ON user_sessions(user_id) 
WHERE is_active = TRUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;

-- Remove the old unique constraint if it exists (it was causing issues)
-- The partial unique index below is better
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_device_id_is_active_key;

-- Enable RLS on user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON user_sessions;

-- RLS Policies for user_sessions
-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions"
  ON user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
  ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions"
  ON user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to invalidate all other sessions for a user (except the current one)
CREATE OR REPLACE FUNCTION invalidate_other_sessions(
  p_user_id UUID,
  p_current_device_id TEXT,
  p_current_session_token TEXT
)
RETURNS TABLE(invalidated_count INTEGER, reason TEXT) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Invalidate all other active sessions for this user
  UPDATE user_sessions
  SET 
    is_active = FALSE,
    invalidated_at = TIMEZONE('utc'::text, NOW()),
    invalidation_reason = 'SESSION_REPLACED'
  WHERE 
    user_id = p_user_id
    AND is_active = TRUE
    AND (device_id != p_current_device_id OR session_token != p_current_session_token);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count, 'SESSION_REPLACED'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create or update a session
CREATE OR REPLACE FUNCTION create_or_update_session(
  p_user_id UUID,
  p_device_id TEXT,
  p_session_token TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE(
  session_id UUID,
  is_new_session BOOLEAN,
  previous_sessions_invalidated INTEGER
) AS $$
DECLARE
  v_existing_session_id UUID;
  v_invalidated_count INTEGER;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Check if there's an existing active session for this user and device
  SELECT id INTO v_existing_session_id
  FROM user_sessions
  WHERE user_id = p_user_id 
    AND device_id = p_device_id 
    AND is_active = TRUE
  LIMIT 1;
  
  -- Invalidate all other sessions for this user (except current device)
  SELECT invalidated_count INTO v_invalidated_count
  FROM invalidate_other_sessions(p_user_id, p_device_id, p_session_token);
  
  IF v_existing_session_id IS NULL THEN
    -- Create new session
    INSERT INTO user_sessions (
      user_id,
      device_id,
      session_token,
      user_agent,
      ip_address,
      is_active,
      last_active_at
    )
    VALUES (
      p_user_id,
      p_device_id,
      p_session_token,
      p_user_agent,
      p_ip_address,
      TRUE,
      TIMEZONE('utc'::text, NOW())
    )
    RETURNING id INTO v_existing_session_id;
    
    v_is_new := TRUE;
  ELSE
    -- Update existing session
    UPDATE user_sessions
    SET 
      session_token = p_session_token,
      user_agent = COALESCE(p_user_agent, user_agent),
      ip_address = COALESCE(p_ip_address, ip_address),
      last_active_at = TIMEZONE('utc'::text, NOW()),
      is_active = TRUE,
      invalidated_at = NULL,
      invalidation_reason = NULL
    WHERE id = v_existing_session_id;
  END IF;
  
  RETURN QUERY SELECT v_existing_session_id, v_is_new, COALESCE(v_invalidated_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate a session
CREATE OR REPLACE FUNCTION validate_session(
  p_session_token TEXT,
  p_device_id TEXT
)
RETURNS TABLE(
  is_valid BOOLEAN,
  user_id UUID,
  session_id UUID,
  invalidation_reason TEXT
) AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Find the session
  SELECT 
    us.id,
    us.user_id,
    us.is_active,
    us.device_id,
    us.invalidation_reason
  INTO v_session
  FROM user_sessions us
  WHERE us.session_token = p_session_token
  LIMIT 1;
  
  -- Check if session exists and is valid
  IF v_session IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'SESSION_NOT_FOUND'::TEXT;
    RETURN;
  END IF;
  
  -- Check if session is active
  IF NOT v_session.is_active THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_session.user_id, 
      v_session.id, 
      COALESCE(v_session.invalidation_reason, 'SESSION_INACTIVE')::TEXT;
    RETURN;
  END IF;
  
  -- Check if device matches (optional - can be strict or lenient)
  -- For now, we'll allow it but log a warning if device doesn't match
  IF v_session.device_id != p_device_id THEN
    -- Device mismatch - invalidate session for security
    UPDATE user_sessions
    SET 
      is_active = FALSE,
      invalidated_at = TIMEZONE('utc'::text, NOW()),
      invalidation_reason = 'DEVICE_MISMATCH'
    WHERE id = v_session.id;
    
    RETURN QUERY SELECT 
      FALSE, 
      v_session.user_id, 
      v_session.id, 
      'DEVICE_MISMATCH'::TEXT;
    RETURN;
  END IF;
  
  -- Update last_active_at
  UPDATE user_sessions
  SET last_active_at = TIMEZONE('utc'::text, NOW())
  WHERE id = v_session.id;
  
  -- Session is valid
  RETURN QUERY SELECT 
    TRUE, 
    v_session.user_id, 
    v_session.id, 
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invalidate a session (for logout)
CREATE OR REPLACE FUNCTION invalidate_session(
  p_session_token TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE user_sessions
  SET 
    is_active = FALSE,
    invalidated_at = TIMEZONE('utc'::text, NOW()),
    invalidation_reason = 'USER_LOGOUT'
  WHERE session_token = p_session_token
    AND is_active = TRUE;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active session for a user
CREATE OR REPLACE FUNCTION get_active_session(
  p_user_id UUID
)
RETURNS TABLE(
  session_id UUID,
  device_id TEXT,
  session_token TEXT,
  last_active_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    us.device_id,
    us.session_token,
    us.last_active_at
  FROM user_sessions us
  WHERE us.user_id = p_user_id
    AND us.is_active = TRUE
  ORDER BY us.last_active_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function to remove old inactive sessions (optional, can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_sessions(
  p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE 
    is_active = FALSE
    AND invalidated_at < TIMEZONE('utc'::text, NOW()) - (p_days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION invalidate_other_sessions(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_or_update_session(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_session(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION invalidate_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_sessions(INTEGER) TO authenticated;

