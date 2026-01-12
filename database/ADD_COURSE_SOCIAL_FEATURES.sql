-- ============================================
-- ADD COURSE SOCIAL FEATURES
-- Comments, Likes, Ratings, and Creator Profiles
-- ============================================

-- Add creator profile fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Create index for profile slug lookup
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(profile_slug) WHERE profile_slug IS NOT NULL;

-- Course Comments table
CREATE TABLE IF NOT EXISTS course_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Course Likes table
CREATE TABLE IF NOT EXISTS course_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(course_id, user_id)
);

-- Course Ratings table
CREATE TABLE IF NOT EXISTS course_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(course_id, user_id)
);

-- Creator Profile Comments table
CREATE TABLE IF NOT EXISTS creator_profile_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Creator Profile Ratings table
CREATE TABLE IF NOT EXISTS creator_profile_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(creator_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_comments_course_id ON course_comments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_comments_user_id ON course_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_likes_course_id ON course_likes(course_id);
CREATE INDEX IF NOT EXISTS idx_course_likes_user_id ON course_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_course_id ON course_ratings(course_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_user_id ON course_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_profile_comments_creator_id ON creator_profile_comments(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_profile_ratings_creator_id ON creator_profile_ratings(creator_id);

-- Enable RLS
ALTER TABLE course_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profile_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profile_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Course Comments
DROP POLICY IF EXISTS "Anyone can view course comments" ON course_comments;
CREATE POLICY "Anyone can view course comments"
  ON course_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create course comments" ON course_comments;
CREATE POLICY "Authenticated users can create course comments"
  ON course_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own comments" ON course_comments;
CREATE POLICY "Users can update their own comments"
  ON course_comments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON course_comments;
CREATE POLICY "Users can delete their own comments"
  ON course_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Course Likes
DROP POLICY IF EXISTS "Anyone can view course likes" ON course_likes;
CREATE POLICY "Anyone can view course likes"
  ON course_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can like courses" ON course_likes;
CREATE POLICY "Authenticated users can like courses"
  ON course_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can unlike courses" ON course_likes;
CREATE POLICY "Users can unlike courses"
  ON course_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Course Ratings
DROP POLICY IF EXISTS "Anyone can view course ratings" ON course_ratings;
CREATE POLICY "Anyone can view course ratings"
  ON course_ratings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can rate courses" ON course_ratings;
CREATE POLICY "Authenticated users can rate courses"
  ON course_ratings FOR ALL
  USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- RLS Policies for Creator Profile Comments
DROP POLICY IF EXISTS "Anyone can view creator profile comments" ON creator_profile_comments;
CREATE POLICY "Anyone can view creator profile comments"
  ON creator_profile_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can comment on creator profiles" ON creator_profile_comments;
CREATE POLICY "Authenticated users can comment on creator profiles"
  ON creator_profile_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own profile comments" ON creator_profile_comments;
CREATE POLICY "Users can update their own profile comments"
  ON creator_profile_comments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own profile comments" ON creator_profile_comments;
CREATE POLICY "Users can delete their own profile comments"
  ON creator_profile_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Creator Profile Ratings
DROP POLICY IF EXISTS "Anyone can view creator profile ratings" ON creator_profile_ratings;
CREATE POLICY "Anyone can view creator profile ratings"
  ON creator_profile_ratings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can rate creator profiles" ON creator_profile_ratings;
CREATE POLICY "Authenticated users can rate creator profiles"
  ON creator_profile_ratings FOR ALL
  USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Function to generate profile slug from name
CREATE OR REPLACE FUNCTION generate_profile_slug(name_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(name_text, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to update updated_at timestamps
DROP TRIGGER IF EXISTS update_course_comments_updated_at ON course_comments;
CREATE TRIGGER update_course_comments_updated_at BEFORE UPDATE ON course_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_course_ratings_updated_at ON course_ratings;
CREATE TRIGGER update_course_ratings_updated_at BEFORE UPDATE ON course_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_creator_profile_comments_updated_at ON creator_profile_comments;
CREATE TRIGGER update_creator_profile_comments_updated_at BEFORE UPDATE ON creator_profile_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_creator_profile_ratings_updated_at ON creator_profile_ratings;
CREATE TRIGGER update_creator_profile_ratings_updated_at BEFORE UPDATE ON creator_profile_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE!
-- ============================================

