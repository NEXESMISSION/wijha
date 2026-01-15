-- Add watermark_code column to profiles table
-- This is a simple, short code that identifies the user for video watermarking
-- ENSURE UNIQUENESS: Each watermark_code is unique to prevent conflicts

-- =============================================
-- STEP 1: Add watermark_code column with UNIQUE constraint
-- =============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS watermark_code TEXT;

-- Remove any existing unique constraint first (if exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_watermark_code_key'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_watermark_code_key;
  END IF;
END $$;

-- Add UNIQUE constraint to ensure no duplicates
ALTER TABLE profiles 
ADD CONSTRAINT profiles_watermark_code_unique UNIQUE (watermark_code);

-- =============================================
-- STEP 2: Create function to generate UNIQUE watermark code
-- =============================================
CREATE OR REPLACE FUNCTION generate_unique_watermark_code(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 0;
  exists_check BOOLEAN;
BEGIN
  -- Start with first 8 characters of user ID
  base_code := UPPER(SUBSTRING(user_id::TEXT FROM 1 FOR 8));
  final_code := base_code;
  
  -- Check if code already exists (excluding current user if updating)
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM profiles 
      WHERE watermark_code = final_code 
      AND id != user_id
    ) INTO exists_check;
    
    -- If code doesn't exist, we're done
    EXIT WHEN NOT exists_check;
    
    -- If code exists, add a suffix (1, 2, 3, etc.)
    counter := counter + 1;
    
    -- For codes longer than 8 chars, use last digit of user ID + counter
    IF counter = 1 THEN
      -- First attempt: add last 2 chars of user ID
      final_code := base_code || UPPER(SUBSTRING(user_id::TEXT FROM 9 FOR 2));
    ELSE
      -- Subsequent attempts: add counter as hex
      final_code := base_code || LPAD(counter::TEXT, 2, '0');
    END IF;
    
    -- Safety: prevent infinite loop (max 100 attempts)
    IF counter > 100 THEN
      -- Fallback: use full hash of user ID
      final_code := UPPER(SUBSTRING(MD5(user_id::TEXT) FROM 1 FOR 8));
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 3: Fix any existing duplicate watermark codes
-- =============================================
-- First, find and fix duplicates
DO $$
DECLARE
  dup_record RECORD;
  new_code TEXT;
BEGIN
  -- Find profiles with duplicate watermark codes
  FOR dup_record IN 
    SELECT id, watermark_code
    FROM profiles
    WHERE watermark_code IN (
      SELECT watermark_code
      FROM profiles
      WHERE watermark_code IS NOT NULL
      GROUP BY watermark_code
      HAVING COUNT(*) > 1
    )
    ORDER BY created_at ASC
  LOOP
    -- Generate new unique code for duplicates (except the first one)
    new_code := generate_unique_watermark_code(dup_record.id);
    
    -- Update with new unique code
    UPDATE profiles
    SET watermark_code = new_code
    WHERE id = dup_record.id;
    
    RAISE NOTICE 'Fixed duplicate watermark_code for user %: % -> %', 
      dup_record.id, dup_record.watermark_code, new_code;
  END LOOP;
END $$;

-- =============================================
-- STEP 4: Update existing profiles with unique watermark codes
-- =============================================
UPDATE profiles
SET watermark_code = generate_unique_watermark_code(id)
WHERE watermark_code IS NULL;

-- =============================================
-- STEP 5: Create trigger to auto-generate UNIQUE watermark_code for new users
-- =============================================
CREATE OR REPLACE FUNCTION set_watermark_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.watermark_code IS NULL OR NEW.watermark_code = '' THEN
    -- Use the unique generation function
    NEW.watermark_code := generate_unique_watermark_code(NEW.id);
  ELSIF EXISTS (
    SELECT 1 FROM profiles 
    WHERE watermark_code = NEW.watermark_code 
    AND id != NEW.id
  ) THEN
    -- If manually set code already exists, generate a unique one
    NEW.watermark_code := generate_unique_watermark_code(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_watermark_code ON profiles;
CREATE TRIGGER trigger_set_watermark_code
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_watermark_code();

-- =============================================
-- STEP 6: Create index for faster lookups
-- =============================================
CREATE INDEX IF NOT EXISTS idx_profiles_watermark_code 
ON profiles(watermark_code);

-- =============================================
-- STEP 7: Verify uniqueness and show results
-- =============================================
-- Check for any remaining duplicates
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT watermark_code
    FROM profiles
    WHERE watermark_code IS NOT NULL
    GROUP BY watermark_code
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate watermark codes!', duplicate_count;
  ELSE
    RAISE NOTICE '✅ All watermark codes are unique!';
  END IF;
END $$;

-- Show sample of profiles with their watermark codes
SELECT 
  id,
  name,
  watermark_code,
  CASE 
    WHEN watermark_code IS NOT NULL THEN '✅ Has code'
    ELSE '❌ Missing code'
  END as status
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- Show statistics
SELECT 
  COUNT(*) as total_profiles,
  COUNT(watermark_code) as profiles_with_code,
  COUNT(DISTINCT watermark_code) as unique_codes,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT watermark_code) THEN '✅ All unique'
    ELSE '⚠️ Duplicates found'
  END as uniqueness_status
FROM profiles;

