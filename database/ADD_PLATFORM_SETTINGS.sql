-- ============================================
-- ADD PLATFORM SETTINGS TABLE
-- This table stores configurable fee percentages
-- ============================================

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single row table
  platform_fee_percent DECIMAL(5, 4) NOT NULL DEFAULT 0.1000 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 1),
  payment_fee_percent DECIMAL(5, 4) NOT NULL DEFAULT 0.0200 CHECK (payment_fee_percent >= 0 AND payment_fee_percent <= 1),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_by UUID REFERENCES profiles(id)
);

-- Insert default values if table is empty
INSERT INTO platform_settings (id, platform_fee_percent, payment_fee_percent)
VALUES (1, 0.1000, 0.0200)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view platform settings (needed for fee calculations)
DROP POLICY IF EXISTS "Anyone can view platform settings" ON platform_settings;
CREATE POLICY "Anyone can view platform settings"
  ON platform_settings FOR SELECT
  USING (true);

-- Only admins can update platform settings
DROP POLICY IF EXISTS "Admins can update platform settings" ON platform_settings;
CREATE POLICY "Admins can update platform settings"
  ON platform_settings FOR UPDATE
  USING (is_user_admin(auth.uid()));

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE!
-- ============================================

