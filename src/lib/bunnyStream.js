/**
 * Bunny Stream Integration Service
 * Handles video uploads and playback URL generation
 * 
 * Note: Actual Bunny Stream API calls should be made via Supabase Edge Functions
 * or a backend API to keep API keys secure. This file provides the client-side
 * interface and structure.
 * 
 * Security Features:
 * - Signed URLs with HMAC-SHA256
 * - Token expiration
 * - Device fingerprinting
 * - Watermark code generation
 * - Event logging
 */

import { supabase } from './supabase'
import { generateDeviceId } from './deviceFingerprint'

/**
 * Upload a video file to Bunny Stream
 * This should call a Supabase Edge Function or backend API
 * 
 * @param {File} file - Video file to upload
 * @param {string} lessonId - Optional lesson ID for tracking
 * @returns {Promise<{video_id: string, video_url: string}>}
 */
export async function uploadVideoToBunny(file, lessonId = null) {
  try {
    // Validate file type
    if (!file.type.startsWith('video/')) {
      throw new Error('الملف المحدد ليس ملف فيديو')
    }

    // Validate file size (max 2GB - adjust as needed)
    const maxSize = 2 * 1024 * 1024 * 1024 // 2GB
    if (file.size > maxSize) {
      throw new Error('حجم الملف كبير جداً. الحد الأقصى هو 2 جيجابايت')
    }

    // Get session token for authorization
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('يجب تسجيل الدخول لرفع الفيديو')
    }

    // Get Supabase URL and anon key from environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const functionsUrl = `${supabaseUrl}/functions/v1/upload-video`

    // Call Supabase Edge Function using direct fetch for better FormData support
    const formData = new FormData()
    formData.append('file', file)
    if (lessonId) {
      formData.append('lessonId', lessonId)
    }

    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('Edge Function error:', errorData)
      console.error('Response status:', response.status)
      console.error('Response headers:', Object.fromEntries(response.headers.entries()))
      
      // إذا كان الخطأ 401، قد يكون الرمز منتهي الصلاحية - حاول تحديث الجلسة
      if (response.status === 401) {
        console.log('JWT may be expired, attempting to refresh session...')
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error('Session refresh failed:', refreshError)
          throw new Error('انتهت صلاحية الجلسة. يرجى تسجيل الخروج وإعادة تسجيل الدخول.')
        }
        // لا نعيد المحاولة تلقائيًا - نطلب من المستخدم المحاولة مرة أخرى
        throw new Error('تم تحديث الجلسة. يرجى المحاولة مرة أخرى.')
      }
      
      throw new Error(errorData.error || errorData.details || `خطأ في رفع الفيديو: ${response.status}`)
    }

    const data = await response.json()
    console.log('[BunnyStream] Upload response:', data)
    
    // Ensure embed_url is always the primary URL for playback
    const embedUrl = data.embed_url || 
      (data.video_id ? `https://iframe.mediadelivery.net/embed/${data.library_id || import.meta.env.VITE_BUNNY_STREAM_LIBRARY_ID || '580416'}/${data.video_id}` : null)
    
    return {
      video_id: data.video_id,
      // IMPORTANT: Use embed_url as primary video_url to avoid 403 errors
      video_url: embedUrl || data.video_url || data.preview_url,
      embed_url: embedUrl,
      thumbnail_url: data.thumbnail_url,
      direct_play_url: data.direct_play_url,
      collection_id: data.collection_id,
      library_id: data.library_id,
      success: data.success
    }
  } catch (error) {
    console.error('Error uploading video to Bunny Stream:', error)
    throw error
  }
}

/**
 * Generate a tokenized playback URL for a video
 * This URL is temporary and expires after a set time
 * Uses signed URLs with HMAC-SHA256 for security
 * The user ID is obtained from the auth session automatically
 * 
 * @param {string} videoId - Bunny Stream video ID
 * @param {string} lessonId - Lesson ID
 * @param {string} deviceId - Device fingerprint ID (optional, auto-generated if not provided)
 * @returns {Promise<{playback_url: string, embed_url: string, expires_at: string, watermark_code: string, tracking_code: string}>}
 */
export async function generatePlaybackUrl(videoId, lessonId, deviceId = null) {
  try {
    // Use provided device ID or generate one
    const actualDeviceId = deviceId || generateDeviceId()
    
    // Call Supabase Edge Function to generate tokenized URL
    // Backend validates enrollment and session, then generates secure signed URL
    const { data, error } = await supabase.functions.invoke('generate-video-url', {
      body: {
        video_id: videoId,
        lesson_id: lessonId,
        device_id: actualDeviceId
      }
    })

    if (error) {
      throw new Error(error.message || 'خطأ في توليد رابط التشغيل')
    }

    return {
      // Primary playback URL (HLS for adaptive streaming)
      playback_url: data.playback_url,
      
      // Alternative quality URLs
      playback_url_720p: data.playback_url_720p,
      playback_url_480p: data.playback_url_480p,
      
      // Embed URL for iframe player
      embed_url: data.embed_url,
      
      // Token validity info
      expires_at: data.expires_at,
      valid_for_seconds: data.valid_for_seconds,
      
      // Watermark and tracking codes for anti-piracy
      watermark_code: data.watermark_code || generateWatermarkCode(null, actualDeviceId),
      tracking_code: data.tracking_code,
      
      // Success flag
      success: data.success
    }
  } catch (error) {
    console.error('Error generating playback URL:', error)
    throw error
  }
}

/**
 * Check if a playback URL is still valid
 * @param {string} expiresAt - ISO date string of expiration
 * @returns {boolean}
 */
export function isPlaybackUrlValid(expiresAt) {
  if (!expiresAt) return false
  const expireTime = new Date(expiresAt).getTime()
  const now = Date.now()
  return now < expireTime
}

/**
 * Get time remaining until URL expires (in seconds)
 * @param {string} expiresAt - ISO date string of expiration
 * @returns {number} - Seconds remaining, 0 if expired
 */
export function getTimeRemaining(expiresAt) {
  if (!expiresAt) return 0
  const expireTime = new Date(expiresAt).getTime()
  const now = Date.now()
  const remaining = Math.floor((expireTime - now) / 1000)
  return Math.max(0, remaining)
}

/**
 * Log video playback event for audit purposes
 * 
 * @param {string} studentId - Student ID
 * @param {string} lessonId - Lesson ID
 * @param {string} deviceId - Device fingerprint ID (optional, auto-generated if not provided)
 * @param {string} eventType - Event type (VIEW, DOWNLOAD_ATTEMPT, SCREENSHOT_ATTEMPT, etc.)
 * @param {object} eventData - Additional event data
 * @returns {Promise<void>}
 */
export async function logVideoEvent(studentId, lessonId, deviceId = null, eventType = 'VIDEO_VIEW', eventData = {}) {
  try {
    const actualDeviceId = deviceId || generateDeviceId()
    
    // Call Supabase RPC function to log the event
    const { error } = await supabase.rpc('log_video_event', {
      p_student_id: studentId,
      p_lesson_id: lessonId,
      p_device_id: actualDeviceId,
      p_event_type: eventType,
      p_event_data: {
        timestamp: new Date().toISOString(),
        ...eventData
      }
    })

    if (error) {
      // Try direct insert as fallback
      const { error: insertError } = await supabase.from('video_events').insert({
        student_id: studentId,
        lesson_id: lessonId,
        device_id: actualDeviceId,
        event_type: eventType,
        event_data: {
          timestamp: new Date().toISOString(),
          ...eventData
        }
      })
      
      if (insertError) {
        console.warn('Failed to log video event:', insertError.message)
      }
    }
  } catch (error) {
    console.warn('Error logging video event:', error)
    // Don't throw - logging failures shouldn't block video playback
  }
}

/**
 * Validate if a user can access a specific video
 * @param {string} userId - User ID
 * @param {string} lessonId - Lesson ID
 * @returns {Promise<{canAccess: boolean, reason?: string}>}
 */
export async function validateVideoAccess(userId, lessonId) {
  try {
    // Get lesson with course info
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        module_id,
        modules!inner(
          id,
          course_id,
          courses!inner(
            id,
            creator_id,
            status
          )
        )
      `)
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return { canAccess: false, reason: 'الدرس غير موجود' }
    }

    const courseId = lesson.modules.course_id
    const creatorId = lesson.modules.courses.creator_id

    // Creator can always access their own content
    if (userId === creatorId) {
      return { canAccess: true, isCreator: true }
    }

    // Check for approved enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('status')
      .eq('student_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'approved')
      .single()

    if (enrollmentError || !enrollment) {
      return { canAccess: false, reason: 'لم يتم التسجيل في هذه الدورة' }
    }

    return { canAccess: true, isEnrolled: true }
  } catch (error) {
    console.error('Error validating video access:', error)
    return { canAccess: false, reason: 'خطأ في التحقق من صلاحية الوصول' }
  }
}

/**
 * Generate watermark code for a user session
 * Format: UID-{first 6 chars of user ID}-{first 6 chars of device ID}
 * 
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {string}
 */
export function generateWatermarkCode(userId, deviceId) {
  const userIdShort = userId ? userId.substring(0, 8).toUpperCase() : 'UNKNOWN'
  const deviceIdShort = deviceId ? deviceId.substring(0, 6).toUpperCase() : 'UNK'
  return `UID-${userIdShort}-${deviceIdShort}`
}

/**
 * Get video upload progress (for future implementation with direct upload)
 * 
 * @param {string} uploadId - Upload tracking ID
 * @returns {Promise<{progress: number, status: string}>}
 */
export async function getUploadProgress(uploadId) {
  try {
    const { data, error } = await supabase.rpc('get_video_upload_progress', {
      p_upload_id: uploadId
    })

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error getting upload progress:', error)
    throw error
  }
}

