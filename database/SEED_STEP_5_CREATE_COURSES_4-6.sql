-- ============================================
-- STEP 5: CREATE COURSES 4-6
-- ============================================
-- Creates courses 4, 5, and 6
-- ============================================

DO $$
DECLARE
  target_user_id UUID;
  user_email TEXT := 'saifelleuchi127@gmail.com';
  cat_business_id UUID;
  cat_languages_id UUID;
  cat_photo_id UUID;
  course4_id UUID;
  course5_id UUID;
  course6_id UUID;
  module1_id UUID;
  module2_id UUID;
  module3_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email LIMIT 1;
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'User not found: %', user_email; END IF;

  SELECT id INTO cat_business_id FROM categories WHERE name = 'إدارة الأعمال' LIMIT 1;
  SELECT id INTO cat_languages_id FROM categories WHERE name = 'لغات' LIMIT 1;
  SELECT id INTO cat_photo_id FROM categories WHERE name = 'تصوير وفيديو' LIMIT 1;

  -- COURSE 4: إدارة المشاريع
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'إدارة المشاريع الاحترافية: Agile و Scrum',
    'تعلم إدارة المشاريع باستخدام منهجيات Agile و Scrum.',
    179.99, cat_business_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
    ARRAY['project management', 'agile', 'scrum']
  ) RETURNING id INTO course4_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course4_id, 'مقدمة في إدارة المشاريع', 0),
  (course4_id, 'Agile Methodology', 1),
  (course4_id, 'Scrum Framework', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course4_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course4_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course4_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'ما هي إدارة المشاريع؟', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 40),
  (module2_id, 'Agile Manifesto', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 35),
  (module3_id, 'Scrum Roles', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50);

  -- COURSE 5: الإنجليزية للأعمال
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'الإنجليزية للأعمال: التواصل الاحترافي',
    'دورة متخصصة في اللغة الإنجليزية للأعمال.',
    149.99, cat_languages_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=600&fit=crop',
    ARRAY['english', 'business english', 'communication']
  ) RETURNING id INTO course5_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course5_id, 'أساسيات الإنجليزية للأعمال', 0),
  (course5_id, 'Business Writing', 1),
  (course5_id, 'Business Calls', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course5_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course5_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course5_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'Business Vocabulary', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module2_id, 'Email Writing', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module3_id, 'Phone Etiquette', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40);

  -- COURSE 6: التصوير الفوتوغرافي
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'التصوير الفوتوغرافي الاحترافي: من الهواية إلى الاحتراف',
    'تعلم التصوير الفوتوغرافي من الصفر.',
    229.99, cat_photo_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=600&fit=crop',
    ARRAY['photography', 'camera', 'lightroom']
  ) RETURNING id INTO course6_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course6_id, 'أساسيات التصوير', 0),
  (course6_id, 'الإعدادات والتحكم', 1),
  (course6_id, 'التكوين والإضاءة', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course6_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course6_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course6_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في التصوير', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 30),
  (module2_id, 'ISO, Aperture, Shutter', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module3_id, 'Rule of Thirds', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40);

  RAISE NOTICE 'Courses 4-6 created successfully!';
END $$;

