# Bunny Stream Integration Implementation Guide

This document outlines the implementation of the Bunny Stream integration as specified in UPDATE.md.

## Implementation Status

### ✅ Completed

1. **Bunny Stream Service Library** (`src/lib/bunnyStream.js`)
   - Created service library for video upload and playback URL generation
   - Functions for upload, tokenized URL generation, and event logging
   - Note: Requires backend implementation (Supabase Edge Functions or backend API)

2. **BunnyPlayer Component** (`src/components/BunnyPlayer.jsx`)
   - Video player component with watermark overlay
   - Session validation support
   - Error handling and loading states
   - Animated watermark that moves subtly to prevent removal

3. **API Functions** (`src/lib/api.js`)
   - Added `validateVideoAccess` function for enrollment validation
   - Structure in place for video-related API calls

4. **Database Schema Updates** (`database/ADD_VIDEO_AUDIT_EVENTS.sql`)
   - Extended audit_logs table with video playback event types
   - Added `log_video_event` function for tracking video events
   - Event types: VIDEO_VIEW, VIDEO_PLAY, VIDEO_PAUSE, VIDEO_COMPLETE, VIDEO_ERROR, VIDEO_DOWNLOAD_ATTEMPT, VIDEO_TOKEN_GENERATED, VIDEO_ACCESS_DENIED

### ⚠️ Requires Backend Implementation

The following components require backend implementation (Supabase Edge Functions or backend API):

1. **Video Upload** (`uploadVideoToBunny` function)
   - Needs Supabase Edge Function: `upload-video`
   - Should handle:
     - File upload to Bunny Stream
     - Return video_id and video_url
     - Validate file size and type

2. **Playback URL Generation** (`generatePlaybackUrl` function)
   - Needs Supabase Edge Function: `generate-video-url`
   - Should handle:
     - Enrollment validation
     - Session validation
     - Device ID validation
     - Generate tokenized URL (expires after X seconds)
     - Return playback_url, expires_at, watermark_code

3. **Video Event Logging** (`logVideoEvent` function)
   - Needs Supabase RPC function: `log_video_event`
   - Database function created in `database/ADD_VIDEO_AUDIT_EVENTS.sql`
   - Should log video events to audit_logs table

### 🔄 In Progress / Required Changes

1. **CreateCourse.jsx** - Update to use file uploads
   - Replace URL inputs with file upload inputs
   - Add video upload handlers
   - Update lesson structure to store video files
   - Update submit handler to upload videos to Bunny Stream

2. **EditCourse.jsx** - Update to use file uploads
   - Replace URL inputs with file upload inputs
   - Handle existing videos vs new uploads
   - Update lesson editing to support video uploads

3. **CourseDetail.jsx** - Update to use BunnyPlayer
   - Replace current video rendering with BunnyPlayer component
   - Add session validation before video playback
   - Integrate watermark display

4. **Database Schema** - Verify video_id field
   - Check if `lessons.video_id` field exists (should already exist per schema.sql)
   - Verify `lessons.video_url` can store Bunny Stream URLs

## Implementation Steps

### Step 1: Run Database Migration

```sql
-- Run the audit logging extension
\i database/ADD_VIDEO_AUDIT_EVENTS.sql
```

### Step 2: Create Supabase Edge Functions (Backend)

Create the following Edge Functions:

1. **upload-video**
   - Accept video file
   - Upload to Bunny Stream
   - Return video_id and video_url
   - Store in database

2. **generate-video-url**
   - Validate enrollment
   - Validate session
   - Generate tokenized URL
   - Return playback URL with expiration

### Step 3: Update Frontend Forms

1. Update `CreateCourse.jsx`:
   - Replace URL inputs with file inputs
   - Add upload progress indicators
   - Update submit handler

2. Update `EditCourse.jsx`:
   - Replace URL inputs with file inputs
   - Handle existing videos
   - Update edit handler

### Step 4: Update Video Playback

1. Update `CourseDetail.jsx`:
   - Replace video rendering with BunnyPlayer
   - Add session validation
   - Integrate watermark

## Environment Variables Required

Add to `.env`:

```
VITE_BUNNY_STREAM_LIBRARY_ID=your_library_id
VITE_BUNNY_STREAM_API_KEY=your_api_key
```

**Note:** API keys should be kept on the backend (Edge Functions), not exposed in frontend.

## Testing Checklist

- [ ] Video upload works from CreateCourse form
- [ ] Video upload works from EditCourse form
- [ ] Videos play with watermark overlay
- [ ] Session validation blocks unauthorized access
- [ ] Video events are logged to audit_logs
- [ ] Tokenized URLs expire correctly
- [ ] Enrollment validation works
- [ ] Watermark code is unique per user/device

## Notes

- Old URL-based video methods are deprecated
- All videos must go through Bunny Stream
- Watermark is critical for tracing leaks
- All video events must be logged for audit

