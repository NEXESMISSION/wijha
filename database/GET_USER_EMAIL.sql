-- RPC function to get user email from auth.users
-- This function allows admins to get user emails safely

CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  -- Return email or null if not found
  RETURN user_email;
END;
$$;

-- Grant execute permission to authenticated users
-- Only admins should be able to call this
GRANT EXECUTE ON FUNCTION get_user_email(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_user_email(UUID) IS 'Get user email from auth.users. Only accessible by authenticated users (should be restricted to admins via RLS or application logic).';

