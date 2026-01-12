-- ============================================
-- ADD THUMBNAIL IMAGE FIELD TO COURSES
-- Separate thumbnail from trailer video URL
-- ============================================

-- Add thumbnail_image_url column to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS thumbnail_image_url TEXT;

-- Add comment to clarify the difference
COMMENT ON COLUMN courses.thumbnail_image_url IS 'Thumbnail image URL for course cards and listings (separate from trailer video)';
COMMENT ON COLUMN courses.trailer_video_url IS 'Trailer video URL (YouTube, PDF, or image) shown on course detail page';

