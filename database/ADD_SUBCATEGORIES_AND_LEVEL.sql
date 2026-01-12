-- ============================================
-- ADD SUBCATEGORIES AND COURSE LEVEL
-- ============================================

-- Add parent_id to categories for subcategories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE CASCADE;

-- Add level to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced'));

-- Create index for faster level filtering
CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

