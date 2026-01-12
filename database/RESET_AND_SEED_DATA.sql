-- ============================================
-- RESET AND SEED DATABASE WITH SAMPLE DATA
-- ============================================
-- This script will:
-- 1. Delete all existing data (in correct order)
-- 2. Create a professional creator account
-- 3. Create multiple detailed courses with modules and lessons
-- ============================================

-- STEP 1: DELETE ALL EXISTING DATA (in order to respect foreign keys)
-- ============================================

DELETE FROM course_comments;
DELETE FROM course_likes;
DELETE FROM course_ratings;
DELETE FROM creator_profile_comments;
DELETE FROM creator_profile_ratings;
DELETE FROM reports;
DELETE FROM payment_proofs;
DELETE FROM enrollments;
DELETE FROM lessons;
DELETE FROM modules;
DELETE FROM courses;
DELETE FROM categories;
DELETE FROM payout_requests;
-- Note: We can't filter by email since profiles table doesn't have email column
-- We'll delete all profiles except the one we're about to create/update
-- The profile will be created/updated in the next step based on auth.users email

-- STEP 2: CREATE CATEGORIES
-- ============================================

INSERT INTO categories (name, icon, description) VALUES
('برمجة وتطوير', '💻', 'دورات في البرمجة وتطوير التطبيقات والمواقع'),
('تصميم جرافيكي', '🎨', 'دورات في التصميم والإبداع البصري'),
('تسويق رقمي', '📱', 'دورات في التسويق الإلكتروني ووسائل التواصل'),
('إدارة الأعمال', '💼', 'دورات في إدارة المشاريع والأعمال'),
('لغات', '🌍', 'دورات في تعلم اللغات'),
('تصوير وفيديو', '📸', 'دورات في التصوير الفوتوغرافي وإنتاج الفيديو'),
('مهارات شخصية', '🌟', 'دورات في تطوير الذات والمهارات الشخصية'),
('مالية واستثمار', '💰', 'دورات في المالية والإستثمار');

-- STEP 3: GET OR CREATE PROFILE FOR saifelleuchi127@gmail.com
-- ============================================

-- First, get the user ID from auth.users
DO $$
DECLARE
  target_user_id UUID;
  target_profile_id UUID;
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

  -- Check if profile exists, if not create it
  SELECT id INTO target_profile_id
  FROM profiles
  WHERE id = target_user_id
  LIMIT 1;

  -- Use INSERT ... ON CONFLICT to handle existing profiles or duplicate slugs
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
  
  -- If profile_slug conflict (different user has it), update to a unique one
  -- Check if slug is taken by another user
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE profile_slug = 'saif-aliouchi' 
    AND id != target_user_id
  ) THEN
    UPDATE profiles
    SET profile_slug = 'saif-aliouchi-' || SUBSTRING(target_user_id::text, 1, 8)
    WHERE id = target_user_id;
  END IF;
END $$;

-- STEP 4: CREATE DETAILED COURSES
-- ============================================

DO $$
DECLARE
  target_user_id UUID;
  user_email TEXT := 'saifelleuchi127@gmail.com';
  cat_programming_id UUID;
  cat_design_id UUID;
  cat_marketing_id UUID;
  cat_business_id UUID;
  cat_languages_id UUID;
  cat_photo_id UUID;
  cat_personal_id UUID;
  cat_finance_id UUID;
  
  course1_id UUID;
  course2_id UUID;
  course3_id UUID;
  course4_id UUID;
  course5_id UUID;
  course6_id UUID;
  course7_id UUID;
  course8_id UUID;
  course9_id UUID;
  course10_id UUID;
  
  module1_id UUID;
  module2_id UUID;
  module3_id UUID;
  module4_id UUID;
  module5_id UUID;
  module6_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users. Please make sure the user account exists in Supabase Auth.', user_email;
  END IF;

  -- Get category IDs (use LIMIT 1 to avoid multiple row errors)
  SELECT id INTO cat_programming_id FROM categories WHERE name = 'برمجة وتطوير' LIMIT 1;
  SELECT id INTO cat_design_id FROM categories WHERE name = 'تصميم جرافيكي' LIMIT 1;
  SELECT id INTO cat_marketing_id FROM categories WHERE name = 'تسويق رقمي' LIMIT 1;
  SELECT id INTO cat_business_id FROM categories WHERE name = 'إدارة الأعمال' LIMIT 1;
  SELECT id INTO cat_languages_id FROM categories WHERE name = 'لغات' LIMIT 1;
  SELECT id INTO cat_photo_id FROM categories WHERE name = 'تصوير وفيديو' LIMIT 1;
  SELECT id INTO cat_personal_id FROM categories WHERE name = 'مهارات شخصية' LIMIT 1;
  SELECT id INTO cat_finance_id FROM categories WHERE name = 'مالية واستثمار' LIMIT 1;

  -- ============================================
  -- COURSE 1: تطوير تطبيقات الويب المتقدمة
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'تطوير تطبيقات الويب المتقدمة باستخدام React و Node.js',
    'دورة شاملة لتعلم تطوير تطبيقات الويب الحديثة من الصفر إلى الاحتراف. ستتعلم React.js، Node.js، Express، MongoDB، وأكثر. ستبني مشاريع حقيقية وتتعلم أفضل الممارسات في تطوير الويب.',
    299.99,
    cat_programming_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df1b3?w=800&h=600&fit=crop',
    ARRAY['react', 'nodejs', 'web development', 'javascript', 'fullstack']
  )
  RETURNING id INTO course1_id;

  -- Modules for Course 1
  INSERT INTO modules (course_id, title, order_index) VALUES
  (course1_id, 'مقدمة في React.js', 0),
  (course1_id, 'مكونات React المتقدمة', 1),
  (course1_id, 'إدارة الحالة مع Redux', 2),
  (course1_id, 'Node.js و Express', 3),
  (course1_id, 'قواعد البيانات MongoDB', 4),
  (course1_id, 'مشروع نهائي شامل', 5)
  RETURNING id INTO module1_id;

  -- Get module IDs for Course 1
  SELECT id INTO module1_id FROM modules WHERE course_id = course1_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course1_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course1_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course1_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course1_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course1_id AND order_index = 5 LIMIT 1;

  -- Lessons for Course 1
  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  -- Module 1: مقدمة في React.js
  (module1_id, 'معاينة الدورة - ما ستتعلمه', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'ما هو React ولماذا نستخدمه؟', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 25),
  (module1_id, 'إعداد بيئة التطوير', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 30),
  (module1_id, 'إنشاء أول مكون React', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 35),
  (module1_id, 'JSX و Props', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 4, 40),
  (module1_id, 'State و Event Handlers', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 5, 45),
  
  -- Module 2: مكونات React المتقدمة
  (module2_id, 'Hooks: useState و useEffect', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module2_id, 'Custom Hooks', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module2_id, 'Context API', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 40),
  (module2_id, 'React Router', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 55),
  (module2_id, 'Forms و Validation', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 4, 50),
  
  -- Module 3: إدارة الحالة مع Redux
  (module3_id, 'مقدمة في Redux', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module3_id, 'Actions و Reducers', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module3_id, 'Redux Toolkit', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 55),
  (module3_id, 'Async Actions مع Thunk', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 60),
  
  -- Module 4: Node.js و Express
  (module4_id, 'مقدمة في Node.js', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module4_id, 'إنشاء RESTful API', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module4_id, 'Middleware و Authentication', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 50),
  (module4_id, 'Error Handling', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 35),
  
  -- Module 5: قواعد البيانات MongoDB
  (module5_id, 'مقدمة في MongoDB', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module5_id, 'Mongoose و Schemas', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module5_id, 'Queries و Aggregation', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 55),
  (module5_id, 'Relationships و Indexing', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 40),
  
  -- Module 6: مشروع نهائي
  (module6_id, 'تخطيط المشروع', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 30),
  (module6_id, 'بناء Backend', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 90),
  (module6_id, 'بناء Frontend', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 120),
  (module6_id, 'التكامل والاختبار', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 60),
  (module6_id, 'النشر والتوزيع', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 4, 45);

  -- ============================================
  -- COURSE 2: تصميم UI/UX احترافي
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'تصميم واجهات المستخدم UI/UX من الصفر إلى الاحتراف',
    'تعلم تصميم واجهات المستخدم الجميلة والسهلة الاستخدام. ستتعلم Figma، Adobe XD، مبادئ التصميم، UX Research، وأكثر. ستصمم مشاريع حقيقية وتتعلم كيفية العمل مع المطورين.',
    249.99,
    cat_design_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop',
    ARRAY['ui', 'ux', 'design', 'figma', 'adobe xd', 'user experience']
  )
  RETURNING id INTO course2_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course2_id, 'مبادئ التصميم الأساسية', 0),
  (course2_id, 'Figma للمبتدئين', 1),
  (course2_id, 'UX Research و User Testing', 2),
  (course2_id, 'تصميم Mobile Apps', 3),
  (course2_id, 'تصميم Web Interfaces', 4),
  (course2_id, 'Portfolio و Presentation', 5);

  -- Get module IDs for Course 2
  SELECT id INTO module1_id FROM modules WHERE course_id = course2_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course2_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course2_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course2_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course2_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course2_id AND order_index = 5 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في UI/UX Design', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 30),
  (module1_id, 'Color Theory و Typography', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module1_id, 'Layout و Grid Systems', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 40),
  (module1_id, 'Spacing و Visual Hierarchy', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 4, 35),
  (module2_id, 'إعداد Figma', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 25),
  (module2_id, 'Components و Styles', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module2_id, 'Prototyping', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module2_id, 'Collaboration Features', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 30),
  (module3_id, 'User Research Methods', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module3_id, 'Personas و User Journeys', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module3_id, 'Wireframing', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module3_id, 'Usability Testing', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 60),
  (module4_id, 'Mobile Design Principles', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module4_id, 'تصميم iOS Apps', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 70),
  (module4_id, 'تصميم Android Apps', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 70),
  (module5_id, 'Web Design Best Practices', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module5_id, 'Responsive Design', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module5_id, 'Design Systems', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 60),
  (module6_id, 'بناء Portfolio', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module6_id, 'Presenting Your Work', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 40);

  -- ============================================
  -- COURSE 3: التسويق الرقمي الشامل
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'التسويق الرقمي الشامل: من الصفر إلى الاحتراف',
    'دورة متكاملة في التسويق الرقمي تغطي Google Ads، Facebook Ads، SEO، Content Marketing، Email Marketing، و Analytics. تعلم كيفية بناء استراتيجية تسويق ناجحة وقياس النتائج.',
    199.99,
    cat_marketing_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    ARRAY['marketing', 'digital marketing', 'seo', 'social media', 'ads', 'analytics']
  )
  RETURNING id INTO course3_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course3_id, 'أساسيات التسويق الرقمي', 0),
  (course3_id, 'Google Ads', 1),
  (course3_id, 'Facebook و Instagram Ads', 2),
  (course3_id, 'SEO و Content Marketing', 3),
  (course3_id, 'Email Marketing', 4),
  (course3_id, 'Analytics و Measurement', 5);

  SELECT id INTO module1_id FROM modules WHERE course_id = course3_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course3_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course3_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course3_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course3_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course3_id AND order_index = 5 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في التسويق الرقمي', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 35),
  (module1_id, 'Buyer Personas', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 40),
  (module1_id, 'Marketing Funnel', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 45),
  (module2_id, 'إعداد حساب Google Ads', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 30),
  (module2_id, 'Keyword Research', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module2_id, 'إنشاء أول حملة إعلانية', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 55),
  (module2_id, 'Optimization و A/B Testing', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 60),
  (module3_id, 'Facebook Ads Manager', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module3_id, 'Audience Targeting', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module3_id, 'Ad Creatives', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 55),
  (module3_id, 'Instagram Ads', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 50),
  (module4_id, 'SEO Fundamentals', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module4_id, 'On-Page SEO', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module4_id, 'Content Strategy', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 65),
  (module4_id, 'Link Building', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 50),
  (module5_id, 'Email Marketing Platforms', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module5_id, 'Email Campaigns', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module5_id, 'Automation', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 50),
  (module6_id, 'Google Analytics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module6_id, 'Tracking Conversions', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module6_id, 'Reporting و Insights', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 50);

  -- ============================================
  -- COURSE 4: إدارة المشاريع الاحترافية
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'إدارة المشاريع الاحترافية: Agile و Scrum',
    'تعلم إدارة المشاريع باستخدام منهجيات Agile و Scrum. ستتعلم كيفية تخطيط المشاريع، إدارة الفرق، استخدام أدوات مثل Jira و Trello، والتعامل مع التحديات الشائعة.',
    179.99,
    cat_business_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
    ARRAY['project management', 'agile', 'scrum', 'business', 'leadership']
  )
  RETURNING id INTO course4_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course4_id, 'مقدمة في إدارة المشاريع', 0),
  (course4_id, 'Agile Methodology', 1),
  (course4_id, 'Scrum Framework', 2),
  (course4_id, 'أدوات إدارة المشاريع', 3),
  (course4_id, 'إدارة الفرق', 4),
  (course4_id, 'Case Studies', 5);

  SELECT id INTO module1_id FROM modules WHERE course_id = course4_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course4_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course4_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course4_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course4_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course4_id AND order_index = 5 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'ما هي إدارة المشاريع؟', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 40),
  (module1_id, 'Project Lifecycle', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module1_id, 'Risk Management', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 50),
  (module2_id, 'Agile Manifesto', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 35),
  (module2_id, 'Sprints و Iterations', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module2_id, 'User Stories', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 40),
  (module3_id, 'Scrum Roles', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module3_id, 'Sprint Planning', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module3_id, 'Daily Standups', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 30),
  (module3_id, 'Sprint Review و Retrospective', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 45),
  (module4_id, 'Jira Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module4_id, 'Trello و Asana', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 40),
  (module4_id, 'Gantt Charts', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 35),
  (module5_id, 'Team Leadership', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module5_id, 'Communication Strategies', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module5_id, 'Conflict Resolution', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module6_id, 'Case Study 1: Tech Startup', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module6_id, 'Case Study 2: Enterprise Project', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 65);

  -- ============================================
  -- COURSE 5: تعلم اللغة الإنجليزية للأعمال
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'الإنجليزية للأعمال: التواصل الاحترافي',
    'دورة متخصصة في اللغة الإنجليزية للأعمال. تعلم كيفية كتابة الإيميلات، إجراء المكالمات، إدارة الاجتماعات، والعروض التقديمية باللغة الإنجليزية.',
    149.99,
    cat_languages_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=600&fit=crop',
    ARRAY['english', 'business english', 'communication', 'language', 'professional']
  )
  RETURNING id INTO course5_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course5_id, 'أساسيات الإنجليزية للأعمال', 0),
  (course5_id, 'Business Writing', 1),
  (course5_id, 'Business Calls', 2),
  (course5_id, 'Meetings و Presentations', 3),
  (course5_id, 'Negotiations', 4);

  SELECT id INTO module1_id FROM modules WHERE course_id = course5_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course5_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course5_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course5_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course5_id AND order_index = 4 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'Business Vocabulary', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module1_id, 'Formal vs Informal', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 40),
  (module2_id, 'Email Writing Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module2_id, 'Professional Emails', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module2_id, 'Reports و Proposals', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 60),
  (module3_id, 'Phone Etiquette', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module3_id, 'Video Calls', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module4_id, 'Leading Meetings', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module4_id, 'Presentations', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 60),
  (module5_id, 'Negotiation Language', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module5_id, 'Closing Deals', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45);

  -- ============================================
  -- COURSE 6: التصوير الفوتوغرافي الاحترافي
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'التصوير الفوتوغرافي الاحترافي: من الهواية إلى الاحتراف',
    'تعلم التصوير الفوتوغرافي من الصفر. ستتعلم الإعدادات الأساسية، التكوين، الإضاءة، التعديل باستخدام Lightroom و Photoshop، وأنواع التصوير المختلفة.',
    229.99,
    cat_photo_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=600&fit=crop',
    ARRAY['photography', 'camera', 'lightroom', 'photoshop', 'creative']
  )
  RETURNING id INTO course6_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course6_id, 'أساسيات التصوير', 0),
  (course6_id, 'الإعدادات والتحكم بالكاميرا', 1),
  (course6_id, 'التكوين والإضاءة', 2),
  (course6_id, 'أنواع التصوير', 3),
  (course6_id, 'التعديل والتحرير', 4),
  (course6_id, 'بناء Portfolio', 5);

  SELECT id INTO module1_id FROM modules WHERE course_id = course6_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course6_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course6_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course6_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course6_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course6_id AND order_index = 5 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في التصوير', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 30),
  (module1_id, 'أنواع الكاميرات', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 40),
  (module1_id, 'العدسات واختيارها', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 45),
  (module2_id, 'ISO, Aperture, Shutter Speed', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module2_id, 'Exposure Triangle', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module2_id, 'Focus Modes', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 40),
  (module2_id, 'White Balance', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 35),
  (module3_id, 'Rule of Thirds', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module3_id, 'Composition Techniques', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module3_id, 'Natural Light', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 55),
  (module3_id, 'Artificial Light', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 60),
  (module4_id, 'Portrait Photography', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 70),
  (module4_id, 'Landscape Photography', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 65),
  (module4_id, 'Street Photography', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 60),
  (module4_id, 'Product Photography', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 75),
  (module5_id, 'Adobe Lightroom Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module5_id, 'Color Grading', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 65),
  (module5_id, 'Photoshop Advanced', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 70),
  (module6_id, 'Selecting Best Photos', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module6_id, 'Creating Portfolio', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50);

  -- ============================================
  -- COURSE 7: تطوير الذات والقيادة
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'تطوير الذات والقيادة: بناء شخصية قيادية ناجحة',
    'دورة شاملة في تطوير الذات والقيادة. تعلم كيفية بناء الثقة، إدارة الوقت، التواصل الفعال، اتخاذ القرارات، وإلهام الفرق.',
    159.99,
    cat_personal_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop',
    ARRAY['leadership', 'personal development', 'self improvement', 'motivation', 'success']
  )
  RETURNING id INTO course7_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course7_id, 'بناء الثقة بالنفس', 0),
  (course7_id, 'إدارة الوقت والإنتاجية', 1),
  (course7_id, 'التواصل الفعال', 2),
  (course7_id, 'القيادة والإلهام', 3),
  (course7_id, 'اتخاذ القرارات', 4);

  SELECT id INTO module1_id FROM modules WHERE course_id = course7_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course7_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course7_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course7_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course7_id AND order_index = 4 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'Self-Awareness', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module1_id, 'Building Confidence', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 50),
  (module1_id, 'Overcoming Fear', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 40),
  (module2_id, 'Time Management Techniques', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module2_id, 'Prioritization', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module2_id, 'Productivity Hacks', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 50),
  (module3_id, 'Active Listening', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module3_id, 'Public Speaking', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module3_id, 'Non-Verbal Communication', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module4_id, 'Leadership Styles', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module4_id, 'Motivating Teams', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module4_id, 'Delegation', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module5_id, 'Decision Making Process', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module5_id, 'Problem Solving', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55);

  -- ============================================
  -- COURSE 8: الاستثمار والمالية الشخصية
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'الاستثمار والمالية الشخصية: بناء الثروة الذكية',
    'تعلم أساسيات الاستثمار والمالية الشخصية. ستتعلم كيفية إدارة الميزانية، الاستثمار في الأسهم والعقارات، التخطيط للتقاعد، وبناء محفظة استثمارية.',
    279.99,
    cat_finance_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=600&fit=crop',
    ARRAY['finance', 'investment', 'money', 'stocks', 'real estate', 'wealth']
  )
  RETURNING id INTO course8_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course8_id, 'أساسيات المالية الشخصية', 0),
  (course8_id, 'الاستثمار في الأسهم', 1),
  (course8_id, 'الاستثمار العقاري', 2),
  (course8_id, 'بناء المحفظة الاستثمارية', 3),
  (course8_id, 'التخطيط المالي', 4);

  SELECT id INTO module1_id FROM modules WHERE course_id = course8_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course8_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course8_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course8_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course8_id AND order_index = 4 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'إدارة الميزانية', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module1_id, 'الادخار الذكي', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module1_id, 'إدارة الديون', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 55),
  (module2_id, 'مقدمة في سوق الأسهم', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module2_id, 'تحليل الشركات', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 65),
  (module2_id, 'Trading Strategies', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 70),
  (module2_id, 'Risk Management', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 55),
  (module3_id, 'Real Estate Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module3_id, 'Property Investment', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 70),
  (module3_id, 'Rental Properties', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 65),
  (module4_id, 'Portfolio Diversification', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module4_id, 'Asset Allocation', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 60),
  (module5_id, 'Retirement Planning', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 65),
  (module5_id, 'Tax Strategies', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 55),
  (module5_id, 'Estate Planning', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 50);

  -- ============================================
  -- COURSE 9: Python للبيانات والذكاء الاصطناعي
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'Python للبيانات والذكاء الاصطناعي: من المبتدئ إلى الخبير',
    'دورة شاملة في Python للبيانات والذكاء الاصطناعي. تعلم Pandas، NumPy، Machine Learning، Deep Learning، وتحليل البيانات.',
    349.99,
    cat_programming_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=600&fit=crop',
    ARRAY['python', 'data science', 'machine learning', 'ai', 'deep learning', 'pandas']
  )
  RETURNING id INTO course9_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course9_id, 'Python Basics', 0),
  (course9_id, 'Data Analysis with Pandas', 1),
  (course9_id, 'Data Visualization', 2),
  (course9_id, 'Machine Learning', 3),
  (course9_id, 'Deep Learning', 4),
  (course9_id, 'Real-World Projects', 5);

  SELECT id INTO module1_id FROM modules WHERE course_id = course9_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course9_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course9_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course9_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course9_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course9_id AND order_index = 5 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'Python Setup', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 30),
  (module1_id, 'Variables و Data Types', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 40),
  (module1_id, 'Control Flow', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 45),
  (module1_id, 'Functions و Classes', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 4, 50),
  (module2_id, 'Pandas Introduction', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module2_id, 'DataFrames', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 60),
  (module2_id, 'Data Cleaning', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 65),
  (module2_id, 'Data Manipulation', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 70),
  (module3_id, 'Matplotlib', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module3_id, 'Seaborn', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 60),
  (module3_id, 'Plotly', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 50),
  (module4_id, 'Scikit-learn Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 65),
  (module4_id, 'Supervised Learning', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 75),
  (module4_id, 'Unsupervised Learning', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 70),
  (module4_id, 'Model Evaluation', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 60),
  (module5_id, 'Neural Networks', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 80),
  (module5_id, 'TensorFlow و Keras', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 85),
  (module5_id, 'CNN و RNN', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 90),
  (module6_id, 'Project 1: Sales Prediction', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 120),
  (module6_id, 'Project 2: Image Classification', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 150);

  -- ============================================
  -- COURSE 10: إنتاج الفيديو الاحترافي
  -- ============================================
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id,
    'إنتاج الفيديو الاحترافي: من الفكرة إلى النشر',
    'تعلم إنتاج الفيديو الاحترافي من الصفر. ستتعلم التصوير، الإضاءة، الصوت، المونتاج باستخدام Premiere Pro و After Effects، وأكثر.',
    269.99,
    cat_photo_id,
    'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=600&fit=crop',
    ARRAY['video', 'production', 'editing', 'premiere pro', 'after effects', 'cinematography']
  )
  RETURNING id INTO course10_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course10_id, 'أساسيات إنتاج الفيديو', 0),
  (course10_id, 'التصوير والإضاءة', 1),
  (course10_id, 'الصوت والميكروفونات', 2),
  (course10_id, 'المونتاج مع Premiere Pro', 3),
  (course10_id, 'After Effects و Motion Graphics', 4),
  (course10_id, 'النشر والتوزيع', 5);

  SELECT id INTO module1_id FROM modules WHERE course_id = course10_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course10_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course10_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course10_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course10_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course10_id AND order_index = 5 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في إنتاج الفيديو', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 40),
  (module1_id, 'أنواع الكاميرات', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module1_id, 'Video Formats', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 35),
  (module2_id, 'Camera Settings', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module2_id, 'Lighting Setup', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 60),
  (module2_id, 'Composition', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 45),
  (module2_id, 'Camera Movement', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 50),
  (module3_id, 'Audio Equipment', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module3_id, 'Recording Audio', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module3_id, 'Audio Editing', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 55),
  (module4_id, 'Premiere Pro Interface', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module4_id, 'Cutting و Editing', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 70),
  (module4_id, 'Color Grading', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 65),
  (module4_id, 'Transitions', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 3, 50),
  (module5_id, 'After Effects Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module5_id, 'Motion Graphics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 75),
  (module5_id, 'Visual Effects', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 80),
  (module6_id, 'Export Settings', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module6_id, 'YouTube و Social Media', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50);

END $$;

-- ============================================
-- DONE!
-- ============================================
-- You now have:
-- - 8 categories
-- - 10 detailed professional courses
-- - Each course has 5-6 modules
-- - Each module has multiple lessons
-- - All courses are published and ready
-- ============================================

