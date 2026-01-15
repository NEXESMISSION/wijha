# Edge Functions Setup Guide

This guide explains how to set up and deploy the Supabase Edge Functions for Bunny Stream integration.

## ✅ Completed

1. **Edge Functions Created:**
   - `supabase/functions/upload-video/index.ts` - Handles video uploads to Bunny Stream
   - `supabase/functions/generate-video-url/index.ts` - Generates tokenized playback URLs

2. **Database Function:**
   - `log_video_event` function already exists (created via `database/ADD_VIDEO_AUDIT_EVENTS.sql`)

## 📋 Prerequisites

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link to your project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```
   
   You can find your project ref in your Supabase dashboard URL:
   `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

## 🔑 Environment Variables

Set these in your Supabase Dashboard:
1. Go to **Project Settings** > **Edge Functions** > **Secrets**
2. Add the following secrets:

   - `BUNNY_STREAM_LIBRARY_ID` - Your Bunny Stream library ID
   - `BUNNY_STREAM_API_KEY` - Your Bunny Stream API key
   - `BUNNY_STREAM_HOSTNAME` - (Optional) Bunny Stream API hostname (defaults to `api.bunny.net`)

## 🚀 Deployment

### Deploy Functions

```bash
# Deploy upload-video function
supabase functions deploy upload-video

# Deploy generate-video-url function
supabase functions deploy generate-video-url
```

### Test Deployment

After deployment, test the functions:

1. **Test upload-video:**
   - Use the CreateCourse form to upload a video
   - Check Supabase logs for any errors

2. **Test generate-video-url:**
   - Access a lesson video from CourseDetail page
   - Check that playback URL is generated correctly

## ⚠️ Important Notes

1. **Bunny Stream API Integration:**
   - The Edge Functions provide a basic structure for Bunny Stream integration
   - You may need to adjust the API calls based on Bunny Stream's actual API documentation
   - Current implementation uses a simplified approach - refer to Bunny Stream docs for exact API format

2. **Video Upload:**
   - The upload function may need adjustment based on Bunny Stream's upload method
   - Some Bunny Stream libraries use different upload endpoints
   - Check Bunny Stream documentation for the correct upload flow

3. **Token Generation:**
   - The tokenized URL generation is simplified
   - In production, use proper JWT signing or Bunny Stream's token generation
   - Current implementation uses base64 encoding as a placeholder

4. **Testing:**
   - Test with small video files first
   - Monitor Supabase function logs for errors
   - Adjust API calls based on Bunny Stream API responses

## 📚 Next Steps

1. Review and adjust Edge Functions based on Bunny Stream API documentation
2. Test video uploads
3. Test playback URL generation
4. Verify audit logging works correctly
5. Continue with frontend implementation (CreateCourse, EditCourse, CourseDetail updates)

