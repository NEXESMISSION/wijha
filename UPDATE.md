Complete Developer Report - Wijha Course Marketplace Platform (Updated)

Version: 1.1.0
Date: 2026
Platform: Web Application (React + Supabase + Bunny Stream)

Key Changes From v1.0.0

Video Handling Updated

No hardcoded video URLs anymore

All course videos must be uploaded via Bunny Stream

Tokenized video URLs for each student session

Non-intrusive, semi-transparent watermark added to each video stream (student-specific)

DRM-like protections applied (player + watermark + session validation)

Security Reinforced

Old URL method deprecated

Supabase Storage policies strictly enforced

Only approved enrollments can access videos

Single-device sessions integrated with video token validation

Logging and auditing ready for DRM events (view, download attempt, etc.)

Course Creation Workflow Updated

Creators cannot input external URLs directly

Videos must be uploaded via Bunny Stream integration

Lesson creation form updated to include Bunny upload + preview

Admin approval ensures videos meet security compliance

Bunny Stream Integration Details
Video Upload Flow (Creator Side)

Creator clicks Add Video in lesson form

Upload modal opens: select file → uploads to Bunny Stream storage

Backend calls Bunny API to generate secure playback URL

URL stored in lessons.video_id / lessons.video_url in database

Admin approval required for all uploaded content before publishing

Video Playback Flow (Student Side)

Student requests lesson video

Backend validates:

Enrollment approved

Session active and device verified

Generate temporary Bunny Stream tokenized URL (expires in X seconds)

Watermark overlay applied on player:

Semi-transparent

Shows unique session code (e.g., UID-ABC123)

Moves slowly to avoid UX disruption

Video rendered through Bunny player only

Attempted screen recording outside browser → watermark visible → traceable

Security Measures Applied

Tokenized Video URLs (expires after X seconds)

Session Binding: URL valid only for student ID + device ID

Watermarking: per-user, semi-transparent, moving overlay

Admin Controls: only approved videos allowed

DRM Simulation: Bunny + watermark + session validation

Course Creation Flow (New)
Creator clicks "Create Course"
  ↓
Fill course metadata (title, description, price, category, level)
  ↓
Add modules
  ↓
Add lessons
  ↓
For each lesson:
      - Upload video via Bunny Stream
      - Generate secure video_id / video_url
      - Optional: trailer upload
  ↓
Save course (status: "draft")
  ↓
Submit for approval (status: "pending")
  ↓
Admin reviews metadata + videos security
  ↓
Admin approves → status: "published" OR rejects → status: "suspended"


Important: Do not allow creator to add external URLs anymore. All videos must go through Bunny Stream integration.

Backend Changes
Database Updates

lessons.video_url → now stores Bunny Stream tokenized URL

lessons.video_id → Bunny media ID

audit_logs → track:

Video playback requests

Token generation events

Enrollment/session mismatches

Storage Policies

course-videos bucket: public=False

payment-proofs bucket: public=False

Bunny Stream serves videos via temporary secure URLs only

All playback requests validated via backend

Supabase Functions Needed

generateVideoPlaybackURL(student_id, lesson_id, device_id)

validateEnrollment(student_id, course_id)

logVideoPlayback(student_id, lesson_id, timestamp, device_id)

Developer Instructions

Remove old URL fields/methods in course creation

Integrate Bunny Stream upload flow in lesson form

Use tokenized URLs for video playback

Enforce session validation before rendering videos

Apply watermark overlay on all videos dynamically

Update admin approval flow to check Bunny Stream uploads

Update audit logging for video security events

Ensure RLS policies enforce only enrolled student access

Frontend Changes

Lesson video component: BunnyPlayer.jsx

Accepts video_url + watermark_code

Renders overlay on top

Handles token expiration

Course creation/edit form:

Replace URL input with Bunny upload widget

Display preview

Handle multiple lesson uploads

Student dashboard: validate session & show only approved content

Important Notes

This is no longer MVP: full security + Bunny integration required

Old video URL methods are deprecated and must not be used

Watermark + session + token URL is critical to trace leaks

All video events must be logged for potential audit