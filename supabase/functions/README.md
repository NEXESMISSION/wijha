# Supabase Edge Functions for Bunny Stream Integration

This directory contains Supabase Edge Functions for handling video uploads and playback URL generation with Bunny Stream.

## Functions

### 1. `upload-video`
Handles video file uploads to Bunny Stream.

**Endpoint:** `/functions/v1/upload-video`

**Method:** POST

**Request:**
- Content-Type: `multipart/form-data`
- Body: FormData with `file` field (video file)

**Response:**
```json
{
  "video_id": "uuid",
  "video_url": "https://...",
  "success": true
}
```

### 2. `generate-video-url`
Generates tokenized playback URLs for Bunny Stream videos.

**Endpoint:** `/functions/v1/generate-video-url`

**Method:** POST

**Request:**
```json
{
  "video_id": "string",
  "lesson_id": "uuid",
  "device_id": "string"
}
```

**Response:**
```json
{
  "playback_url": "https://...",
  "expires_at": "2024-01-01T00:00:00.000Z",
  "watermark_code": "UID-ABC123-DEF456",
  "success": true
}
```

## Environment Variables

Set these in your Supabase Dashboard under Project Settings > Edge Functions > Secrets:

- `BUNNY_STREAM_LIBRARY_ID` - Your Bunny Stream library ID
- `BUNNY_STREAM_API_KEY` - Your Bunny Stream API key
- `BUNNY_STREAM_HOSTNAME` - (Optional) Bunny Stream API hostname (defaults to `api.bunny.net`)

## Deployment

### Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link to your project:
```bash
supabase link --project-ref your-project-ref
```

### Deploy Functions

Deploy all functions:
```bash
supabase functions deploy upload-video
supabase functions deploy generate-video-url
```

Or deploy all at once:
```bash
supabase functions deploy
```

### Set Environment Variables

After deployment, set the environment variables in Supabase Dashboard:
1. Go to Project Settings > Edge Functions > Secrets
2. Add the following secrets:
   - `BUNNY_STREAM_LIBRARY_ID`
   - `BUNNY_STREAM_API_KEY`
   - `BUNNY_STREAM_HOSTNAME` (optional)

## Database Function

The `log_video_event` function is already created in the database (see `database/ADD_VIDEO_AUDIT_EVENTS.sql`).

## Testing

You can test the functions using curl or your frontend application:

### Test upload-video:
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/upload-video \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -F "file=@video.mp4"
```

### Test generate-video-url:
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/generate-video-url \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "video-id",
    "lesson_id": "lesson-uuid",
    "device_id": "device-id"
  }'
```

## Notes

- The functions require authentication (Bearer token in Authorization header)
- Video uploads are limited to 2GB
- Tokenized URLs expire after 1 hour (configurable in `generate-video-url/index.ts`)
- Make sure your Bunny Stream library is properly configured
- The functions validate enrollment before generating playback URLs

