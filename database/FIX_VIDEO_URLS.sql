-- FIX: Update existing video_url entries to use embed URLs instead of CDN URLs
-- This fixes 403 errors when CDN token authentication is enabled
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: View current video URLs to understand the issue
-- =============================================
SELECT 
  l.id,
  l.title,
  l.video_id,
  l.video_url,
  CASE 
    WHEN l.video_url LIKE '%b-cdn.net%' THEN 'CDN_URL (needs fix)'
    WHEN l.video_url LIKE '%iframe.mediadelivery.net%' THEN 'EMBED_URL (OK)'
    WHEN l.video_url LIKE '%youtube.com%' OR l.video_url LIKE '%youtu.be%' THEN 'YOUTUBE (OK)'
    WHEN l.video_url LIKE '%vimeo.com%' THEN 'VIMEO (OK)'
    ELSE 'OTHER'
  END as url_type
FROM lessons l
WHERE l.video_url IS NOT NULL
ORDER BY l.created_at DESC;

-- =============================================
-- STEP 2: Update CDN URLs to embed URLs
-- This converts URLs like:
--   https://vz-xxx.b-cdn.net/{video_id}/playlist.m3u8
-- To:
--   https://iframe.mediadelivery.net/embed/{library_id}/{video_id}
-- =============================================

-- First, let's set the library ID (get this from your Bunny Stream dashboard)
-- Replace '580416' with your actual library ID
DO $$
DECLARE
  v_library_id TEXT := '580416';  -- YOUR BUNNY STREAM LIBRARY ID
  v_video_id TEXT;
  v_lesson RECORD;
  v_updated_count INTEGER := 0;
BEGIN
  -- Loop through all lessons with CDN URLs
  FOR v_lesson IN 
    SELECT id, video_url, video_id
    FROM lessons
    WHERE video_url LIKE '%b-cdn.net%'
  LOOP
    -- Extract video_id from URL if not already stored
    IF v_lesson.video_id IS NOT NULL THEN
      v_video_id := v_lesson.video_id;
    ELSE
      -- Try to extract from URL pattern: /xxx-xxx-xxx/
      v_video_id := (regexp_match(v_lesson.video_url, 'b-cdn\.net/([a-f0-9-]+)/'))[1];
    END IF;
    
    IF v_video_id IS NOT NULL THEN
      -- Update to embed URL
      UPDATE lessons
      SET video_url = 'https://iframe.mediadelivery.net/embed/' || v_library_id || '/' || v_video_id || '?autoplay=false&loop=false&muted=false&preload=true&responsive=true'
      WHERE id = v_lesson.id;
      
      v_updated_count := v_updated_count + 1;
      RAISE NOTICE 'Updated lesson %: video_id=%', v_lesson.id, v_video_id;
    ELSE
      RAISE WARNING 'Could not extract video_id from URL for lesson %', v_lesson.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total lessons updated: %', v_updated_count;
END $$;

-- =============================================
-- STEP 3: Also update trailer_video_url in courses table
-- =============================================
DO $$
DECLARE
  v_library_id TEXT := '580416';  -- YOUR BUNNY STREAM LIBRARY ID
  v_video_id TEXT;
  v_course RECORD;
  v_updated_count INTEGER := 0;
BEGIN
  -- Loop through all courses with CDN trailer URLs
  FOR v_course IN 
    SELECT id, trailer_video_url
    FROM courses
    WHERE trailer_video_url LIKE '%b-cdn.net%'
  LOOP
    -- Extract video_id from URL
    v_video_id := (regexp_match(v_course.trailer_video_url, 'b-cdn\.net/([a-f0-9-]+)/'))[1];
    
    IF v_video_id IS NOT NULL THEN
      -- Update to embed URL
      UPDATE courses
      SET trailer_video_url = 'https://iframe.mediadelivery.net/embed/' || v_library_id || '/' || v_video_id || '?autoplay=false&loop=false&muted=false&preload=true&responsive=true'
      WHERE id = v_course.id;
      
      v_updated_count := v_updated_count + 1;
      RAISE NOTICE 'Updated course trailer %: video_id=%', v_course.id, v_video_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total course trailers updated: %', v_updated_count;
END $$;

-- =============================================
-- STEP 4: Verify the fix
-- =============================================
SELECT 
  l.id,
  l.title,
  l.video_id,
  l.video_url,
  CASE 
    WHEN l.video_url LIKE '%iframe.mediadelivery.net%' THEN '✅ Fixed'
    WHEN l.video_url LIKE '%b-cdn.net%' THEN '❌ Still needs fix'
    ELSE '⚠️ Other type'
  END as status
FROM lessons l
WHERE l.video_url IS NOT NULL
ORDER BY l.created_at DESC;

-- =============================================
-- STEP 5: Show summary
-- =============================================
SELECT 
  COUNT(*) FILTER (WHERE video_url LIKE '%iframe.mediadelivery.net%') as embed_urls,
  COUNT(*) FILTER (WHERE video_url LIKE '%b-cdn.net%') as cdn_urls,
  COUNT(*) FILTER (WHERE video_url LIKE '%youtube%' OR video_url LIKE '%youtu.be%') as youtube_urls,
  COUNT(*) FILTER (WHERE video_url LIKE '%vimeo%') as vimeo_urls,
  COUNT(*) as total
FROM lessons
WHERE video_url IS NOT NULL;

