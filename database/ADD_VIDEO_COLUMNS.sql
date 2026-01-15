-- Add video_id and video_url columns to lessons table if they don't exist
-- Run this in Supabase SQL Editor

-- Add video_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lessons' AND column_name = 'video_id'
    ) THEN
        ALTER TABLE lessons ADD COLUMN video_id TEXT;
        RAISE NOTICE 'Added video_id column to lessons table';
    ELSE
        RAISE NOTICE 'video_id column already exists in lessons table';
    END IF;
END $$;

-- Add video_url column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lessons' AND column_name = 'video_url'
    ) THEN
        ALTER TABLE lessons ADD COLUMN video_url TEXT;
        RAISE NOTICE 'Added video_url column to lessons table';
    ELSE
        RAISE NOTICE 'video_url column already exists in lessons table';
    END IF;
END $$;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lessons'
ORDER BY ordinal_position;

