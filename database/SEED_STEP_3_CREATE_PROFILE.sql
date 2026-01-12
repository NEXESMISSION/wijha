-- ============================================
-- STEP 3: CREATE/UPDATE PROFILE
-- ============================================
-- Run this to create or update the creator profile
-- ============================================

DO $$
DECLARE
  target_user_id UUID;
  user_email TEXT := 'saifelleuchi127@gmail.com';
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users. Please make sure the user account exists in Supabase Auth (Authentication > Users).', user_email;
  END IF;

  -- Use INSERT ... ON CONFLICT to handle existing profiles
  INSERT INTO profiles (id, name, role, profile_slug, bio, profile_image_url, cover_image_url, website_url)
  VALUES (
    target_user_id,
    'سيف العليوشي',
    'creator',
    'saif-aliouchi',
    'مطور برمجيات ومصمم واجهات مستخدم محترف مع أكثر من 12 عاماً من الخبرة في تطوير التطبيقات والمواقع الإلكترونية. متخصص في تقنيات الويب الحديثة، الذكاء الاصطناعي، وتطوير تطبيقات الهاتف المحمول. حاصل على شهادات معتمدة من Google و Microsoft، وقمت بتدريب أكثر من 5000 طالب في مختلف أنحاء العالم.',
    'https://i.pravatar.cc/300?img=12&size=300',
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1600&h=500&fit=crop&q=80',
    'https://saifaliouchi.dev'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    profile_slug = EXCLUDED.profile_slug,
    bio = EXCLUDED.bio,
    profile_image_url = EXCLUDED.profile_image_url,
    cover_image_url = EXCLUDED.cover_image_url,
    website_url = EXCLUDED.website_url;
  
  -- Handle profile_slug conflict if another user has it
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE profile_slug = 'saif-aliouchi' 
    AND id != target_user_id
    LIMIT 1
  ) THEN
    UPDATE profiles
    SET profile_slug = 'saif-aliouchi-' || SUBSTRING(target_user_id::text, 1, 8)
    WHERE id = target_user_id;
  END IF;
  
  RAISE NOTICE 'Profile created/updated successfully for user: %', user_email;
END $$;

