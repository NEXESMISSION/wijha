# Bunny Stream Implementation Checklist

## ✅ Completed Tasks

### 1. Backend Setup
- [x] Created Supabase Edge Functions (`upload-video`, `generate-video-url`)
- [x] Created database RPC function (`log_video_event`)
- [x] Updated database schema (added `video_id` and `video_url` to `lessons` table)
- [x] Configured environment variables (Bunny Stream credentials in `.env`)
- [x] Fixed Edge Function authentication (added Authorization header for FormData)

### 2. Frontend Components
- [x] Created `BunnyPlayer.jsx` component
- [x] Created `bunnyStream.js` service library
- [x] Updated `CreateCourse.jsx` to use file uploads instead of URLs
- [x] Updated `EditCourse.jsx` to use file uploads instead of URLs
- [x] Fixed auto-logout issue in `AuthContext.jsx`

### 3. Integration
- [x] Integrated Bunny Stream upload in course creation
- [x] Integrated Bunny Stream upload in course editing
- [x] Added progress indicators for video uploads
- [x] Added upload validation (file type, size limits)

## ⏳ Remaining Tasks

### 1. Student Video Playback (CourseDetail.jsx)
- [ ] Replace `renderLink` function with `BunnyPlayer` component
- [ ] Integrate `generatePlaybackUrl` from `bunnyStream.js`
- [ ] Add session validation before video playback
- [ ] Add watermark code generation for videos
- [ ] Handle token expiration and refresh
- [ ] Add video event logging (VIEW, PLAY events)
- [ ] Update video player UI to match design system

### 2. Video Security & Validation
- [ ] Verify Edge Functions are deployed to production
- [ ] Test video upload flow end-to-end
- [ ] Test video playback with tokenized URLs
- [ ] Verify watermark rendering on videos
- [ ] Test session validation for video access
- [ ] Verify audit logging for video events

### 3. Database & API Updates
- [ ] Verify `updateLesson` API function supports `video_id` and `video_url`
- [ ] Verify `createLesson` API function supports `video_id` and `video_url`
- [ ] Test database RPC function `log_video_event`
- [ ] Verify `getCourseWithModules` returns `video_id` field

### 4. Testing & Deployment
- [ ] Test course creation with video uploads
- [ ] Test course editing with video uploads
- [ ] Test student video playback
- [ ] Test video access control (enrollment validation)
- [ ] Test video watermark display
- [ ] Test video event logging
- [ ] Deploy Edge Functions to production
- [ ] Verify environment variables are set in production

### 5. Documentation & Cleanup
- [ ] Update API documentation for video endpoints
- [ ] Update component documentation for `BunnyPlayer`
- [ ] Remove deprecated URL input methods
- [ ] Update user documentation for video uploads

## 📋 Step-by-Step Implementation Guide

### Step 1: Update CourseDetail.jsx
1. Import `BunnyPlayer` component
2. Import `generatePlaybackUrl` and `logVideoEvent` from `bunnyStream.js`
3. Replace `renderLink` function with `BunnyPlayer` component
4. Generate playback URL with token before displaying video
5. Add watermark code generation
6. Log video events (VIEW, PLAY)
7. Handle token expiration

### Step 2: Deploy Edge Functions
1. Deploy `upload-video` Edge Function to Supabase
2. Deploy `generate-video-url` Edge Function to Supabase
3. Set environment variables in Supabase Dashboard
4. Test Edge Functions with test requests

### Step 3: Verify Database Functions
1. Run `LOG_VIDEO_EVENT_FUNCTION.sql` in Supabase SQL Editor
2. Verify `log_video_event` function exists
3. Test the function with sample data

### Step 4: Test End-to-End Flow
1. Create a course with video uploads
2. Edit a course with video uploads
3. Enroll as a student
4. View course and play videos
5. Verify watermark appears on videos
6. Verify audit logs are created

## 🔍 Key Files to Review

- `src/pages/CourseDetail.jsx` - Needs BunnyPlayer integration
- `src/components/BunnyPlayer.jsx` - Video player component
- `src/lib/bunnyStream.js` - Bunny Stream service
- `supabase/functions/upload-video/index.ts` - Upload Edge Function
- `supabase/functions/generate-video-url/index.ts` - URL generation Edge Function
- `database/LOG_VIDEO_EVENT_FUNCTION.sql` - Database RPC function

## 🚨 Important Notes

1. **Edge Functions must be deployed** before video uploads will work
2. **Environment variables** must be set in Supabase Dashboard (Edge Function secrets)
3. **Database functions** must be created in Supabase SQL Editor
4. **Video playback** requires enrollment validation and session tokens
5. **Watermarks** are client-side overlays (may need server-side for better security)
6. **Token expiration** should be handled gracefully with refresh logic

## 📝 Next Steps

1. Complete `CourseDetail.jsx` integration with `BunnyPlayer`
2. Deploy Edge Functions to production
3. Test the complete video flow
4. Verify security measures (watermarks, tokens, validation)
5. Monitor video event logs for issues

