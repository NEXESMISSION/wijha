-- ============================================
-- CATEGORIES SYSTEM
-- Add categories table and update courses table
-- ============================================

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Optional icon/emoji for the category
  created_by_admin_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add category_id to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_courses_category_id ON courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);

-- ============================================
-- RLS POLICIES FOR CATEGORIES
-- ============================================

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

-- Only admins can create categories
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
CREATE POLICY "Admins can create categories"
  ON categories FOR INSERT
  WITH CHECK (is_user_admin(auth.uid()));

-- Only admins can update categories
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  USING (is_user_admin(auth.uid()));

-- Only admins can delete categories
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  USING (is_user_admin(auth.uid()));

-- ============================================
-- SAMPLE CATEGORIES (Optional - can be removed)
-- ============================================

-- Insert some default categories (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM categories LIMIT 1) THEN
    INSERT INTO categories (name, description, icon) VALUES
      ('برمجة', 'دورات البرمجة والتطوير', '💻'),
      ('تصميم', 'دورات التصميم الجرافيكي والويب', '🎨'),
      ('أعمال', 'دورات الأعمال والإدارة', '💼'),
      ('مهارات شخصية', 'دورات تطوير المهارات الشخصية', '🌟'),
      ('لغات', 'دورات تعلم اللغات', '🌍'),
      ('صحة ولياقة', 'دورات الصحة واللياقة البدنية', '💪'),
      ('طبخ', 'دورات الطبخ والطهي', '👨‍🍳'),
      ('فنون', 'دورات الفنون والإبداع', '🎭')
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

