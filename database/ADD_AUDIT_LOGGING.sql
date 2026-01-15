-- ============================================
-- ADD AUDIT LOGGING TABLE
-- Logs security events: login attempts, role changes, admin actions, session invalidations
-- ============================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
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
    'ACCOUNT_DELETED'
  )),
  resource_type TEXT, -- 'course', 'enrollment', 'payout', 'profile', etc.
  resource_id UUID, -- ID of the affected resource
  details JSONB, -- Additional event details (IP address, user agent, etc.)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON audit_logs(user_id, event_type, created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Only service role can insert audit logs (prevent tampering)
-- Note: In production, use Supabase service role or Edge Functions to insert logs
-- This policy ensures users cannot manually insert logs
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
-- This policy will be handled by SECURITY DEFINER functions

-- Function to log role changes (trigger on profiles.role updates)
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (user_id, event_type, resource_type, resource_id, details)
    VALUES (
      NEW.id,
      'ROLE_CHANGED',
      'profile',
      NEW.id,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'changed_by', auth.uid()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for role changes
DROP TRIGGER IF EXISTS trigger_log_role_change ON profiles;
CREATE TRIGGER trigger_log_role_change
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_role_change();

-- Function to log enrollment approvals/rejections
CREATE OR REPLACE FUNCTION log_enrollment_action()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO audit_logs (user_id, event_type, resource_type, resource_id, details)
      VALUES (
        NEW.approved_by_admin_id,
        'ENROLLMENT_APPROVED',
        'enrollment',
        NEW.id,
        jsonb_build_object(
          'student_id', NEW.student_id,
          'course_id', NEW.course_id,
          'approved_by', NEW.approved_by_admin_id
        )
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO audit_logs (user_id, event_type, resource_type, resource_id, details)
      VALUES (
        NEW.approved_by_admin_id,
        'ENROLLMENT_REJECTED',
        'enrollment',
        NEW.id,
        jsonb_build_object(
          'student_id', NEW.student_id,
          'course_id', NEW.course_id,
          'rejected_by', NEW.approved_by_admin_id,
          'rejection_note', NEW.rejection_note
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for enrollment status changes
DROP TRIGGER IF EXISTS trigger_log_enrollment_action ON enrollments;
CREATE TRIGGER trigger_log_enrollment_action
  AFTER UPDATE ON enrollments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected'))
  EXECUTE FUNCTION log_enrollment_action();

-- Function to log course approvals/rejections
CREATE OR REPLACE FUNCTION log_course_action()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'published' AND OLD.status = 'pending' THEN
      INSERT INTO audit_logs (user_id, event_type, resource_type, resource_id, details)
      VALUES (
        NEW.creator_id,
        'COURSE_APPROVED',
        'course',
        NEW.id,
        jsonb_build_object(
          'creator_id', NEW.creator_id,
          'title', NEW.title
        )
      );
    ELSIF NEW.status = 'suspended' AND OLD.status IN ('published', 'pending') THEN
      INSERT INTO audit_logs (user_id, event_type, resource_type, resource_id, details)
      VALUES (
        NEW.creator_id,
        'COURSE_REJECTED',
        'course',
        NEW.id,
        jsonb_build_object(
          'creator_id', NEW.creator_id,
          'title', NEW.title
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for course status changes
DROP TRIGGER IF EXISTS trigger_log_course_action ON courses;
CREATE TRIGGER trigger_log_course_action
  AFTER UPDATE ON courses
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('published', 'suspended'))
  EXECUTE FUNCTION log_course_action();

-- Function to log payout approvals/rejections
CREATE OR REPLACE FUNCTION log_payout_action()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO audit_logs (user_id, event_type, resource_type, resource_id, details)
      VALUES (
        NEW.approved_by_admin_id,
        'PAYOUT_APPROVED',
        'payout',
        NEW.id,
        jsonb_build_object(
          'creator_id', NEW.creator_id,
          'amount', NEW.amount,
          'approved_by', NEW.approved_by_admin_id
        )
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO audit_logs (user_id, event_type, resource_type, resource_id, details)
      VALUES (
        NEW.approved_by_admin_id,
        'PAYOUT_REJECTED',
        'payout',
        NEW.id,
        jsonb_build_object(
          'creator_id', NEW.creator_id,
          'amount', NEW.amount,
          'rejected_by', NEW.approved_by_admin_id,
          'admin_note', NEW.admin_note
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for payout status changes
DROP TRIGGER IF EXISTS trigger_log_payout_action ON payout_requests;
CREATE TRIGGER trigger_log_payout_action
  AFTER UPDATE ON payout_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected'))
  EXECUTE FUNCTION log_payout_action();

-- Helper function to manually log security events (for use in Edge Functions or API)
-- This should be called from server-side code (Edge Functions) with service role
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    event_type,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    p_event_type,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE!
-- ============================================
-- Note: Login attempts and session invalidations should be logged from the application code
-- using the log_security_event() function or via Supabase Edge Functions.
-- Failed login attempts can also be tracked via Supabase Auth logs.

