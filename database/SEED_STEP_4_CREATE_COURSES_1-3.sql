-- ============================================
-- STEP 4: CREATE COURSES 1-3
-- ============================================
-- Creates first 3 courses with all modules and lessons
-- Run this after steps 1, 2, and 3
-- ============================================

DO $$
DECLARE
  target_user_id UUID;
  user_email TEXT := 'saifelleuchi127@gmail.com';
  cat_programming_id UUID;
  cat_design_id UUID;
  cat_marketing_id UUID;
  course1_id UUID;
  course2_id UUID;
  course3_id UUID;
  module1_id UUID;
  module2_id UUID;
  module3_id UUID;
  module4_id UUID;
  module5_id UUID;
  module6_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user_email;
  END IF;

  -- Get category IDs
  SELECT id INTO cat_programming_id FROM categories WHERE name = 'برمجة وتطوير' LIMIT 1;
  SELECT id INTO cat_design_id FROM categories WHERE name = 'تصميم جرافيكي' LIMIT 1;
  SELECT id INTO cat_marketing_id FROM categories WHERE name = 'تسويق رقمي' LIMIT 1;

  -- COURSE 1: تطوير تطبيقات الويب المتقدمة
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'تطوير تطبيقات الويب المتقدمة باستخدام React و Node.js',
    'دورة شاملة لتعلم تطوير تطبيقات الويب الحديثة من الصفر إلى الاحتراف.',
    299.99, cat_programming_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df1b3?w=800&h=600&fit=crop',
    ARRAY['react', 'nodejs', 'web development']
  ) RETURNING id INTO course1_id;

  -- Modules for Course 1
  INSERT INTO modules (course_id, title, order_index) VALUES
  (course1_id, 'مقدمة في React.js', 0),
  (course1_id, 'مكونات React المتقدمة', 1),
  (course1_id, 'إدارة الحالة مع Redux', 2),
  (course1_id, 'Node.js و Express', 3),
  (course1_id, 'قواعد البيانات MongoDB', 4),
  (course1_id, 'مشروع نهائي شامل', 5);

  -- Get module IDs
  SELECT id INTO module1_id FROM modules WHERE course_id = course1_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course1_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course1_id AND order_index = 2 LIMIT 1;
  SELECT id INTO module4_id FROM modules WHERE course_id = course1_id AND order_index = 3 LIMIT 1;
  SELECT id INTO module5_id FROM modules WHERE course_id = course1_id AND order_index = 4 LIMIT 1;
  SELECT id INTO module6_id FROM modules WHERE course_id = course1_id AND order_index = 5 LIMIT 1;

  -- Lessons for Course 1
  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'ما هو React؟', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 25),
  (module1_id, 'إعداد بيئة التطوير', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 2, 30),
  (module2_id, 'Hooks: useState', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module2_id, 'Custom Hooks', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module3_id, 'مقدمة في Redux', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module4_id, 'مقدمة في Node.js', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40),
  (module5_id, 'مقدمة في MongoDB', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45),
  (module6_id, 'مشروع نهائي', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 90);

  -- COURSE 2: تصميم UI/UX
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'تصميم واجهات المستخدم UI/UX من الصفر إلى الاحتراف',
    'تعلم تصميم واجهات المستخدم الجميلة والسهلة الاستخدام.',
    249.99, cat_design_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop',
    ARRAY['ui', 'ux', 'design', 'figma']
  ) RETURNING id INTO course2_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course2_id, 'مبادئ التصميم الأساسية', 0),
  (course2_id, 'Figma للمبتدئين', 1),
  (course2_id, 'UX Research', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course2_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course2_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course2_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في UI/UX', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 30),
  (module2_id, 'إعداد Figma', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 25),
  (module3_id, 'User Research', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55);

  -- COURSE 3: التسويق الرقمي
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'التسويق الرقمي الشامل: من الصفر إلى الاحتراف',
    'دورة متكاملة في التسويق الرقمي.',
    199.99, cat_marketing_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    ARRAY['marketing', 'digital marketing', 'seo']
  ) RETURNING id INTO course3_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course3_id, 'أساسيات التسويق الرقمي', 0),
  (course3_id, 'Google Ads', 1),
  (course3_id, 'Facebook Ads', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course3_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course3_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course3_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في التسويق الرقمي', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 35),
  (module2_id, 'إعداد حساب Google Ads', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 30),
  (module3_id, 'Facebook Ads Manager', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45);

  RAISE NOTICE 'Courses 1-3 created successfully!';
END $$;

