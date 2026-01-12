-- ============================================
-- STEP 6: CREATE COURSES 7-10
-- ============================================
-- Creates the remaining 4 courses
-- ============================================

DO $$
DECLARE
  target_user_id UUID;
  user_email TEXT := 'saifelleuchi127@gmail.com';
  cat_personal_id UUID;
  cat_finance_id UUID;
  cat_programming_id UUID;
  course7_id UUID;
  course8_id UUID;
  course9_id UUID;
  course10_id UUID;
  module1_id UUID;
  module2_id UUID;
  module3_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email LIMIT 1;
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'User not found: %', user_email; END IF;

  SELECT id INTO cat_personal_id FROM categories WHERE name = 'مهارات شخصية' LIMIT 1;
  SELECT id INTO cat_finance_id FROM categories WHERE name = 'مالية واستثمار' LIMIT 1;
  SELECT id INTO cat_programming_id FROM categories WHERE name = 'برمجة وتطوير' LIMIT 1;

  -- COURSE 7: تطوير الذات
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'تطوير الذات والقيادة: بناء شخصية قيادية ناجحة',
    'دورة شاملة في تطوير الذات والقيادة.',
    159.99, cat_personal_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop',
    ARRAY['leadership', 'personal development', 'self improvement']
  ) RETURNING id INTO course7_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course7_id, 'بناء الثقة بالنفس', 0),
  (course7_id, 'إدارة الوقت', 1),
  (course7_id, 'التواصل الفعال', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course7_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course7_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course7_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'Self-Awareness', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 45),
  (module2_id, 'Time Management', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module3_id, 'Active Listening', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 40);

  -- COURSE 8: الاستثمار
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'الاستثمار والمالية الشخصية: بناء الثروة الذكية',
    'تعلم أساسيات الاستثمار والمالية الشخصية.',
    279.99, cat_finance_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=600&fit=crop',
    ARRAY['finance', 'investment', 'money', 'stocks']
  ) RETURNING id INTO course8_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course8_id, 'أساسيات المالية الشخصية', 0),
  (course8_id, 'الاستثمار في الأسهم', 1),
  (course8_id, 'الاستثمار العقاري', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course8_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course8_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course8_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'إدارة الميزانية', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 50),
  (module2_id, 'مقدمة في سوق الأسهم', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60),
  (module3_id, 'Real Estate Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 60);

  -- COURSE 9: Python للبيانات
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'Python للبيانات والذكاء الاصطناعي: من المبتدئ إلى الخبير',
    'دورة شاملة في Python للبيانات والذكاء الاصطناعي.',
    349.99, cat_programming_id, 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=600&fit=crop',
    ARRAY['python', 'data science', 'machine learning', 'ai']
  ) RETURNING id INTO course9_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course9_id, 'Python Basics', 0),
  (course9_id, 'Data Analysis', 1),
  (course9_id, 'Machine Learning', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course9_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course9_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course9_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'Python Setup', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 30),
  (module2_id, 'Pandas Introduction', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 55),
  (module3_id, 'Scikit-learn Basics', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 65);

  -- COURSE 10: إنتاج الفيديو
  INSERT INTO courses (creator_id, title, description, price, category_id, status, trailer_video_url, thumbnail_image_url, tags)
  VALUES (
    target_user_id, 'إنتاج الفيديو الاحترافي: من الفكرة إلى النشر',
    'تعلم إنتاج الفيديو الاحترافي من الصفر.',
    269.99, (SELECT id FROM categories WHERE name = 'تصوير وفيديو' LIMIT 1), 'published',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=600&fit=crop',
    ARRAY['video', 'production', 'editing', 'premiere pro']
  ) RETURNING id INTO course10_id;

  INSERT INTO modules (course_id, title, order_index) VALUES
  (course10_id, 'أساسيات إنتاج الفيديو', 0),
  (course10_id, 'التصوير والإضاءة', 1),
  (course10_id, 'المونتاج', 2);

  SELECT id INTO module1_id FROM modules WHERE course_id = course10_id AND order_index = 0 LIMIT 1;
  SELECT id INTO module2_id FROM modules WHERE course_id = course10_id AND order_index = 1 LIMIT 1;
  SELECT id INTO module3_id FROM modules WHERE course_id = course10_id AND order_index = 2 LIMIT 1;

  INSERT INTO lessons (module_id, title, video_url, is_trailer, order_index, duration) VALUES
  (module1_id, 'معاينة الدورة', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0, 5),
  (module1_id, 'مقدمة في إنتاج الفيديو', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 1, 40),
  (module2_id, 'Camera Settings', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 50),
  (module3_id, 'Premiere Pro Interface', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false, 0, 45);

  RAISE NOTICE 'Courses 7-10 created successfully!';
END $$;

