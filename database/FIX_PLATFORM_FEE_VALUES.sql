-- ============================================
-- FIX PLATFORM FEE VALUES
-- If fees are stored incorrectly (as 0.002 instead of 0.2 for 20%)
-- This script will fix them
-- ============================================

-- Check current values
SELECT 
  id,
  platform_fee_percent,
  payment_fee_percent,
  updated_at
FROM platform_settings;

-- If platform_fee_percent is less than 0.01 (meaning it's stored as 0.002 instead of 0.2)
-- Multiply by 100 to fix it
UPDATE platform_settings
SET 
  platform_fee_percent = platform_fee_percent * 100,
  payment_fee_percent = payment_fee_percent * 100,
  updated_at = NOW()
WHERE platform_fee_percent < 0.01 OR payment_fee_percent < 0.01;

-- Verify the fix
SELECT 
  id,
  platform_fee_percent,
  payment_fee_percent,
  platform_fee_percent * 100 as platform_fee_percentage,
  payment_fee_percent * 100 as payment_fee_percentage,
  updated_at
FROM platform_settings;

-- ============================================
-- NOTE: The database stores fees as DECIMALS (0.2 = 20%)
-- So if you want 20%, store 0.2
-- If you want 2%, store 0.02
-- ============================================

