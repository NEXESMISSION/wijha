import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import { 
  getCourseWithModules, 
  createEnrollment, 
  createPaymentProof, 
  getStudentEnrollments, 
  checkEnrollmentRestriction,
  getCourseStats,
  getCourseComments,
  createCourseComment,
  deleteCourseComment,
  toggleCourseLike,
  checkCourseLike,
  setCourseRating,
  getCourseRating,
  createReport,
  createDodoCheckout,
  createManualDodoEnrollment
} from '../lib/api'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateFileUpload } from '../lib/security'
import SecureBunnyPlayer from '../components/SecureBunnyPlayer'
import '../styles/design-system.css'
import './Course.css'

/**
 * Format duration from seconds to human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., "5:30" or "1:05:30")
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format total duration to Arabic readable format
 * @param {number} seconds - Total duration in seconds
 * @returns {string} - Formatted duration (e.g., "ساعتان و 30 دقيقة")
 */
function formatTotalDuration(seconds) {
  if (!seconds || seconds <= 0) return null
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  let result = ''
  
  if (hours > 0) {
    if (hours === 1) {
      result += 'ساعة'
    } else if (hours === 2) {
      result += 'ساعتان'
    } else if (hours >= 3 && hours <= 10) {
      result += `${hours} ساعات`
    } else {
      result += `${hours} ساعة`
    }
  }
  
  if (minutes > 0) {
    if (result) result += ' و '
    if (minutes === 1) {
      result += 'دقيقة'
    } else if (minutes === 2) {
      result += 'دقيقتان'
    } else if (minutes >= 3 && minutes <= 10) {
      result += `${minutes} دقائق`
    } else {
      result += `${minutes} دقيقة`
    }
  }
  
  return result || 'أقل من دقيقة'
}

// Lesson Item Component
function LessonItem({ lesson, canAccess, isActive, lessonNumber, onLessonClick, onEnrollClick }) {
  const durationText = formatDuration(lesson.duration)
  if (!canAccess) {
  return (
      <div 
        onClick={onEnrollClick}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 8px',
          borderRadius: '8px',
          marginBottom: '6px',
          fontSize: '14px',
          color: '#9ca3af',
          background: '#f9fafb',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f3f4f6'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#f9fafb'
        }}
      >
        <span style={{ flex: 1 }}>🔒 {lessonNumber}. {lesson.title}</span>
        {durationText && (
          <span style={{ 
            color: '#6b7280', 
            fontSize: '12px',
            background: '#e5e7eb',
            padding: '2px 8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontWeight: 500,
            marginRight: '8px'
          }}>
            ⏱ {durationText}
          </span>
        )}
      </div>
    )
  }
  
  return (
    <div 
      onClick={() => onLessonClick && onLessonClick(lesson.id)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 8px',
        borderRadius: '8px',
        marginBottom: '6px',
        fontSize: '14px',
        cursor: 'pointer',
        background: isActive ? '#e0edff' : 'transparent',
        color: isActive ? '#2563eb' : '#1f2937',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = '#f3f4f6'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      <span style={{ flex: 1 }}>{lessonNumber}. {lesson.title}</span>
      {durationText && (
        <span style={{ 
          color: isActive ? '#2563eb' : '#6b7280', 
          fontSize: '12px',
          background: isActive ? '#dbeafe' : '#f3f4f6',
          padding: '2px 8px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontWeight: 500,
          marginRight: '8px'
        }}>
          ⏱ {durationText}
        </span>
      )}
    </div>
  )
}

function CourseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { showSuccess, showError, showWarning } = useAlert()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [restriction, setRestriction] = useState(null)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollStep, setEnrollStep] = useState(1) // 1: Choose payment method, 2: Upload receipt
  const [paymentFile, setPaymentFile] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('bank')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeLesson, setActiveLesson] = useState(null)
  
  // Social features
  const [courseStats, setCourseStats] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isLiked, setIsLiked] = useState(false)
  const [userRating, setUserRating] = useState(null)

  useEffect(() => {
    if (id) {
      loadCourse()
    }
  }, [id])

  // Check for payment status from DODO redirect - SIMPLIFIED VERSION
  useEffect(() => {
    const paymentMethodParam = searchParams.get('payment_method')
    const checkEnrollmentParam = searchParams.get('check_enrollment')
    
    if (paymentMethodParam === 'dodo' && checkEnrollmentParam === 'true' && user?.id && id) {
      // Simple flow: Immediately try to create enrollment and show popup
      const handlePaymentReturn = async () => {
        try {
          // First, check if enrollment already exists (webhook might have created it)
          const enrollmentResult = await checkEnrollment()
          
          if (enrollmentResult?.status === 'approved') {
            // Enrollment already exists - success!
            showSuccess('تم الدفع بنجاح! تم تسجيلك في الدورة.')
            setShowEnrollModal(false)
            setEnrollStep(1)
            setSearchParams({})
            return
          }
          
          // Enrollment doesn't exist - create it manually
          const manualEnrollResult = await createManualDodoEnrollment({
            courseId: id,
            paymentId: null
          })
          
          if (manualEnrollResult?.success && manualEnrollResult?.enrollment_id) {
            // Success! Enrollment created
            await checkEnrollment() // Refresh enrollment status
            showSuccess('تم الدفع بنجاح! تم تسجيلك في الدورة.')
            setShowEnrollModal(false)
            setEnrollStep(1)
          } else {
            // Failed to create enrollment
            showError('فشل الدفع أو تم إلغاؤه. يرجى المحاولة مرة أخرى.')
          }
        } catch (error) {
          // Error occurred - show failure message
          console.error('[CourseDetail] Payment verification error:', error)
          showError('فشل الدفع أو تم إلغاؤه. يرجى المحاولة مرة أخرى.')
        }
        
        // Remove query params
        setSearchParams({})
      }
      
      handlePaymentReturn()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, id])

  useEffect(() => {
    if (course && user?.id) {
      // Load enrollment and social features in background (non-blocking)
      // Don't block the UI - these can load after the page is shown
      Promise.all([
        checkEnrollment().catch(() => {}),
        loadSocialFeatures().catch(() => {})
      ]).catch(() => {})
    }
  }, [course, user])

  const loadCourse = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Add timeout to prevent hanging
      const coursePromise = getCourseWithModules(id)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Course load timeout')), 5000)
      )
      
      const data = await Promise.race([coursePromise, timeoutPromise])
      
      // Set course and clear loading IMMEDIATELY
      setCourse(data)
      setLoading(false) // Clear loading immediately - don't wait for anything
      
      // Set trailer as default active lesson/video (non-blocking)
      let trailerLesson = null
      if (data.modules && data.modules.length > 0) {
        for (const module of data.modules) {
          if (module.lessons && module.lessons.length > 0) {
            trailerLesson = module.lessons.find(l => l.is_trailer)
            if (trailerLesson) break
          }
        }
      }
      
      // Set trailer as active by default
      if (trailerLesson) {
        setActiveLesson(trailerLesson.id)
      } else if (data.trailer_video_url) {
        // Use course trailer_video_url if no trailer lesson exists
        setActiveLesson('trailer')
      } else if (data.modules && data.modules.length > 0) {
        // Fallback to first regular lesson if no trailer
        for (const module of data.modules) {
          if (module.lessons && module.lessons.length > 0) {
            const firstLesson = module.lessons.find(l => !l.is_trailer)
            if (firstLesson) {
              setActiveLesson(firstLesson.id)
              break
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تحميل الدورة')
      console.error('Error loading course:', err)
      setLoading(false)
    }
  }

  const checkEnrollment = async () => {
    if (!user || user.role !== 'student') {
      setEnrollment(null)
      return null
    }
    
    try {
      // Add timeout to prevent hanging
      const enrollmentPromise = getStudentEnrollments(user.id)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Enrollment check timeout')), 5000)
      )
      
      const enrollments = await Promise.race([enrollmentPromise, timeoutPromise])
      const courseEnrollment = enrollments.find(e => e.course_id === id)
      setEnrollment(courseEnrollment || null)
      
      if (courseEnrollment) {
        // Load restriction in background (non-blocking)
        checkEnrollmentRestriction(user.id, id)
          .then(restrictionData => setRestriction(restrictionData))
          .catch(() => {})
      }
      
      // Return enrollment object for payment verification
      return courseEnrollment || null
    } catch (err) {
      console.error('Error checking enrollment:', err)
      // Silent fail - don't block UI
      return null
    }
  }

  const loadSocialFeatures = async () => {
    try {
      // Add timeout to prevent hanging
      const socialPromise = Promise.all([
        getCourseStats(id).catch(() => null),
        getCourseComments(id).catch(() => [])
      ])
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Social features timeout')), 5000)
      )
      
      const [stats, commentsData] = await Promise.race([socialPromise, timeoutPromise])
      
      setCourseStats(stats)
      setComments(commentsData || [])
      
      // Only check like and rating if user is logged in (non-blocking)
      if (user?.id) {
        Promise.all([
          checkCourseLike(id, user.id).catch(() => false),
          getCourseRating(id, user.id).catch(() => 0)
        ]).then(([liked, rating]) => {
          setIsLiked(liked)
          setUserRating(rating || 0)
        }).catch(() => {})
      }
    } catch (err) {
      console.error('Error loading social features:', err)
      // Silent fail - don't block UI
    }
  }

  const uploadPaymentProof = async (file) => {
    try {
      // Validate file before upload
      const validation = validateFileUpload(file, {
        maxSize: 10 * 1024 * 1024, // 10MB for payment proofs
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
        allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']
      })
      
      if (!validation.valid) {
        throw new Error(validation.error)
      }
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      // Upload directly to root of bucket (no folder prefix)
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error details:', uploadError)
        // If bucket doesn't exist or RLS issue, provide helpful error
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error('Bucket "payment-proofs" not found. Please create it in Supabase Storage dashboard first.')
        }
        if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('RLS')) {
          throw new Error('Permission denied. Please ensure you are logged in as a student and the storage policies are set up correctly.')
        }
        throw uploadError
      }

      return filePath
    } catch (err) {
      console.error('Error uploading file:', err)
      throw err
    }
  }

  const handleEnrollStep1 = async () => {
    // If DODO payment, redirect to checkout
    if (paymentMethod === 'dodo') {
      if (!user) {
        navigate('/login')
        return
      }

      try {
        setSubmitting(true)
        const checkoutUrl = await createDodoCheckout({
          courseId: id,
          courseTitle: course?.title || 'Course',
          coursePrice: parseFloat(course?.price || 0),
          userEmail: user?.email || ''
        })
        
        // Redirect to DODO checkout
        window.location.href = checkoutUrl
      } catch (err) {
        showError('خطأ في إنشاء جلسة الدفع: ' + err.message)
        console.error('Error creating DODO checkout:', err)
        setSubmitting(false)
      }
    } else {
      // Move to step 2: Upload receipt for other payment methods
    setEnrollStep(2)
    }
  }

  const handleEnrollSubmit = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    if (user.role !== 'student') {
      showWarning('يجب أن تكون طالباً للتسجيل في الدورة')
      return
    }

    if (!paymentFile) {
      showWarning('يرجى رفع إثبات الدفع')
      return
    }

    try {
      setSubmitting(true)
      
      let fileUrl = null
      if (paymentFile) {
        fileUrl = await uploadPaymentProof(paymentFile)
      }

      const enrollmentData = await createEnrollment({
        student_id: user.id,
        course_id: id,
        status: 'pending'
      })

      if (fileUrl) {
      await createPaymentProof({
        enrollment_id: enrollmentData.id,
          file_url: fileUrl,
        payment_method: paymentMethod,
          notes: paymentNotes
      })
      }

      showSuccess('تم إرسال طلب التسجيل بنجاح! في انتظار الموافقة.', 'تم إرسال الطلب')
      setShowEnrollModal(false)
      setEnrollStep(1)
      setPaymentFile(null)
      setPaymentNotes('')
      await checkEnrollment()
    } catch (err) {
      showError('خطأ في التسجيل: ' + err.message)
      console.error('Error submitting enrollment:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLessonClick = (lessonId) => {
    if (!canAccessContent) {
      // Show enrollment modal if not enrolled
      setShowEnrollModal(true)
      setEnrollStep(1)
    } else {
      // Set active lesson if enrolled
      setActiveLesson(lessonId)
    }
  }

  const handleLike = async () => {
    if (!user?.id) {
      showWarning('يرجى تسجيل الدخول أولاً')
      return
    }
    try {
      await toggleCourseLike(id, user.id)
      setIsLiked(!isLiked)
      await loadSocialFeatures()
    } catch (err) {
      showError('خطأ في تحديث الإعجاب: ' + err.message)
    }
  }

  const handleRate = async (rating) => {
    if (!user?.id) {
      showWarning('يرجى تسجيل الدخول أولاً')
      return
    }
    try {
      await setCourseRating(id, user.id, rating)
      setUserRating(rating)
      await loadSocialFeatures()
    } catch (err) {
      showError('خطأ في التقييم: ' + err.message)
    }
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !user?.id) return

    try {
      await createCourseComment(id, user.id, newComment)
      setNewComment('')
      await loadSocialFeatures()
    } catch (err) {
      showError('خطأ في إضافة التعليق: ' + err.message)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التعليق؟')) return

    try {
      await deleteCourseComment(commentId)
      await loadSocialFeatures()
    } catch (err) {
      showError('خطأ في حذف التعليق: ' + err.message)
    }
  }

  const handleReport = async (type, itemId) => {
    const reason = prompt('يرجى إدخال سبب البلاغ:')
    if (!reason) return

    try {
      await createReport({
        reporter_id: user.id,
        report_type: type,
        reported_item_id: itemId,
        reason,
        status: 'pending'
      })
      showSuccess('تم إرسال البلاغ بنجاح', 'تم الإرسال')
    } catch (err) {
      showError('خطأ في إرسال البلاغ: ' + err.message)
    }
  }

  const canAccessContent = user?.role === 'student' && enrollment?.status === 'approved'

  const creatorName = course?.profiles?.name || 'غير معروف'
  const creatorIdentifier = course?.profiles?.profile_slug || course?.profiles?.id || course?.creator_id

  // Render video/image/PDF link
  const renderLink = (url) => {
    if (!url) return null
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const match = url.match(youtubeRegex)
    if (match) {
      const videoId = match[1]
        return (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#111827',
          overflow: 'hidden'
        }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
              }}
            />
          </div>
        )
    }
    
    // Bunny Stream - Check for mediadelivery.net embed URLs or b-cdn.net URLs
    if (url.includes('iframe.mediadelivery.net') || url.includes('b-cdn.net') || url.includes('mediadelivery.net')) {
      // Extract video ID from various Bunny URL formats
      let videoId = null
      
      // From embed URL: iframe.mediadelivery.net/embed/{libraryId}/{videoId}
      const embedMatch = url.match(/mediadelivery\.net\/embed\/\d+\/([a-f0-9-]+)/i)
      if (embedMatch) {
        videoId = embedMatch[1]
      }
      
      // From CDN URL: vz-xxx.b-cdn.net/{videoId}/playlist.m3u8
      if (!videoId) {
        const cdnMatch = url.match(/b-cdn\.net\/([a-f0-9-]+)\//i)
        if (cdnMatch) {
          videoId = cdnMatch[1]
        }
      }
      
      // From other mediadelivery format
      if (!videoId) {
        const otherMatch = url.match(/mediadelivery\.net\/(?:embed\/\d+\/)?([a-f0-9-]+)/i)
        if (otherMatch) {
          videoId = otherMatch[1]
        }
      }
      
      if (videoId) {
        // Use SecureBunnyPlayer for authenticated video playback
        // This will fetch signed URLs when user is enrolled
        return (
          <SecureBunnyPlayer
            videoId={videoId}
            lessonId={activeLesson && activeLesson !== 'trailer' ? activeLesson : null}
            requireAuth={canAccessContent && activeLesson && activeLesson !== 'trailer'}
            fallbackUrl={url.includes('?token=') ? url : null}
            style={{ minHeight: '400px' }}
          />
        )
      }
      
      // Fallback to direct iframe if no video ID found
      return (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#111827',
          overflow: 'hidden'
        }}>
          <iframe
            src={url}
            loading="lazy"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }
    
    // Direct video files (mp4, webm, etc.)
    if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
      return (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#111827',
          overflow: 'hidden'
        }}>
          <video
            src={url}
            controls
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
            متصفحك لا يدعم تشغيل الفيديو
          </video>
          </div>
        )
    }
    
    // PDF
    if (url.toLowerCase().endsWith('.pdf') || url.includes('pdf')) {
      return (
        <div style={{
          background: '#f9fafb',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn-gradient"
            style={{ display: 'inline-block' }}
          >
            📄 فتح ملف PDF
          </a>
        </div>
      )
    }
    
    // Image
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return (
        <img 
          src={url} 
          alt="Course content" 
          style={{
            width: '100%',
            borderRadius: '12px',
            boxShadow: '0 10px 30px -5px rgba(22, 22, 22, 0.08)'
          }}
        />
      )
    }
    
    // Generic link
    return (
      <div style={{
        background: '#f9fafb',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="btn-gradient"
          style={{ display: 'inline-block' }}
        >
          فتح الرابط
        </a>
      </div>
    )
  }

  // Get current active lesson video URL
  const getActiveLessonVideo = () => {
    if (!course) return null
    
    // If activeLesson is 'trailer', use course trailer_video_url
    if (activeLesson === 'trailer') {
      return course.trailer_video_url || null
    }
    
    // If activeLesson is set, find and return that lesson's video
    if (activeLesson) {
      for (const module of course.modules || []) {
        const lesson = module.lessons?.find(l => l.id === activeLesson)
        if (lesson && lesson.video_url) {
          return lesson.video_url
        }
      }
    }
    
    // Default: Find trailer lesson and use its video_url
    for (const module of course.modules || []) {
      const trailerLesson = module.lessons?.find(l => l.is_trailer)
      if (trailerLesson && trailerLesson.video_url) {
        return trailerLesson.video_url
      }
    }
    
    // Fallback to course trailer_video_url
    return course.trailer_video_url || null
  }

  const rawVideoUrl = getActiveLessonVideo()
  
  // Convert any direct CDN URL to embed URL to avoid 403 errors
  const convertToEmbedUrl = (url) => {
    if (!url) return null
    
    // Already an embed URL - return as is
    if (url.includes('iframe.mediadelivery.net/embed')) {
      return url
    }
    
    // Extract video ID from b-cdn.net URL
    const bunnyMatch = url.match(/b-cdn\.net\/([a-f0-9-]+)\//i)
    if (bunnyMatch) {
      const videoId = bunnyMatch[1]
      const libraryId = import.meta.env.VITE_BUNNY_STREAM_LIBRARY_ID || '580416'
      console.log('[CourseDetail] Converting CDN URL to embed:', { original: url, videoId, libraryId })
      return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`
    }
    
    // Return original URL for YouTube, Vimeo, etc.
    return url
  }
  
  const currentVideoUrl = convertToEmbedUrl(rawVideoUrl)
  // Debug log removed to reduce console spam
  
  const totalLessons = course?.modules?.reduce((acc, module) => {
    return acc + (module.lessons?.filter(l => !l.is_trailer).length || 0)
  }, 0) || 0
  
  // Calculate total duration of all lessons (in seconds)
  const totalDurationSeconds = course?.modules?.reduce((acc, module) => {
    return acc + (module.lessons?.reduce((lessonAcc, lesson) => {
      return lessonAcc + (lesson.duration || 0)
    }, 0) || 0)
  }, 0) || 0
  
  const totalDurationText = formatTotalDuration(totalDurationSeconds)

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        fontSize: '1.25rem',
        color: '#6b7280'
      }}>
        جاري تحميل الدورة...
      </div>
    )
  }

  if (error || !course) {
    return (
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem 1rem'
      }}>
        <div className="error-message">
          خطأ: {error || 'الدورة غير موجودة'}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      {/* Course Header - Redesigned */}
      <div style={{
        background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
        borderRadius: '1rem',
        padding: '0',
        marginBottom: '2rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden'
      }}>
        {/* Thumbnail Image - Full Width */}
        {course.thumbnail_image_url && (
          <div style={{
            width: '100%',
            height: '400px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)'
          }}
          className="course-cover-image"
          >
            <img 
              src={course.thumbnail_image_url} 
              alt={course.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          </div>
        )}
        
        {/* Course Info - Below Thumbnail */}
        <div style={{
          padding: '2rem',
          background: 'white'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '2rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem'
          }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              {course.categories && (
                <div style={{
                  fontSize: '0.875rem',
                  color: '#7C34D9',
                  marginBottom: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#f3f4f6',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontWeight: 600
                }}>
                  {course.categories.icon} {course.categories.name}
                </div>
              )}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: '1rem',
                flexWrap: 'wrap'
              }}>
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  color: '#1f2937',
                  margin: 0,
                  lineHeight: '1.2',
                  flex: 1,
                  minWidth: '200px'
                }}>
                  {course.title}
                </h1>
                {user?.id && user.id !== course.creator_id && (
                  <button
                    onClick={() => handleReport('course', course.id)}
                    style={{
                      background: 'white',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#ef4444'
                      e.currentTarget.style.color = '#ef4444'
                      e.currentTarget.style.background = '#fef2f2'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb'
                      e.currentTarget.style.color = '#6b7280'
                      e.currentTarget.style.background = 'white'
                    }}
                  >
                    🚩 إبلاغ
              </button>
            )}
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
              }}>
                {creatorIdentifier && (
                  <Link 
                    to={`/creator/${creatorIdentifier}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      textDecoration: 'none',
                      color: '#374151',
                      fontSize: '0.9375rem',
                      fontWeight: 500
                    }}
                  >
                    <img 
                      src={course.profiles?.profile_image_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(creatorName) + '&background=7C34D9&color=fff'} 
                      alt={creatorName}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        background: '#e5e7eb',
                        border: '2px solid #e5e7eb'
                      }}
                      onError={(e) => {
                        e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(creatorName) + '&background=7C34D9&color=fff'
                        e.target.onerror = null
                      }}
                    />
                    <span>{creatorName}</span>
                  </Link>
                )}
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  color: '#6b7280',
                  fontSize: '0.9375rem',
                  flexWrap: 'wrap'
                }}>
                  <span>📚 {totalLessons} درس</span>
                  {totalDurationText && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}>
                      ⏱ {totalDurationText}
                    </span>
                  )}
                  {courseStats && (
                    <>
                      <span>👥 {courseStats.enrollmentCount} طالب</span>
                      {courseStats.averageRating > 0 && (
                        <span>⭐ {courseStats.averageRating.toFixed(1)}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <p style={{
                color: '#4b5563',
                fontSize: '1.125rem',
                lineHeight: '1.7',
                marginBottom: '2rem'
              }}>
                {course.description}
              </p>
            </div>
            
            {/* Enrollment Card */}
            <div style={{
              background: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '1.5rem',
              padding: '0',
              minWidth: '300px',
              boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
              position: 'sticky',
              top: '100px'
            }}>
              {user?.role === 'student' && (
                <>
                  {restriction ? (
                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '0',
                      padding: '2rem',
                      color: '#dc2626',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textAlign: 'center'
                    }}>
                      ⚠️ محظور من التسجيل
                    </div>
                  ) : enrollment?.status === 'rejected' ? (
                    <div style={{ padding: '2rem' }}>
                      <button 
                        onClick={() => {
                          setShowEnrollModal(true)
                          setEnrollStep(1)
                        }} 
                        style={{
                          width: '100%',
                          padding: '1.25rem 2rem',
                          fontSize: '1.125rem',
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '1rem',
                          cursor: 'pointer',
                          boxShadow: '0 8px 20px rgba(124, 52, 217, 0.3)',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.75rem'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-3px)'
                          e.currentTarget.style.boxShadow = '0 12px 28px rgba(124, 52, 217, 0.4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 8px 20px rgba(124, 52, 217, 0.3)'
                        }}
                      >
                        <span>🔄</span>
                        <span>حاول مرة أخرى</span>
                      </button>
                    </div>
                  ) : enrollment?.status === 'pending' ? (
                    <div style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '0',
                      padding: '2rem',
                      color: '#92400e',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textAlign: 'center'
                    }}>
                      ⏳ قيد الموافقة
                    </div>
                  ) : enrollment?.status === 'approved' ? (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '0',
                      padding: '2rem',
                      color: '#166534',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textAlign: 'center'
                    }}>
                      ✓ مسجل في الدورة
                    </div>
                  ) : (
                    <div style={{ padding: '2rem' }}>
                      <button 
                        onClick={() => {
                          setShowEnrollModal(true)
                          setEnrollStep(1)
                        }} 
                        style={{
                          width: '100%',
                          padding: '1.5rem 2rem',
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '1rem',
                          cursor: 'pointer',
                          boxShadow: '0 10px 30px rgba(124, 52, 217, 0.35)',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.5rem',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                          e.currentTarget.style.boxShadow = '0 15px 40px rgba(124, 52, 217, 0.45)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0) scale(1)'
                          e.currentTarget.style.boxShadow = '0 10px 30px rgba(124, 52, 217, 0.35)'
                        }}
                      >
                        <span style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          opacity: 0.9,
                          letterSpacing: '0.5px'
                        }}>
                          سجل الآن مقابل
              </span>
                        <span style={{
                          fontSize: '2rem',
                          fontWeight: 900,
                          lineHeight: 1
                        }}>
                          {parseFloat(course.price).toFixed(2)} د.ت
                        </span>
                        <div style={{
                          position: 'absolute',
                          top: '-50%',
                          left: '-50%',
                          width: '200%',
                          height: '200%',
                          background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                          animation: 'shimmer 3s infinite',
                          pointerEvents: 'none'
                        }} />
                      </button>
                    </div>
                  )}
                </>
              )}
              {(!user || user?.role !== 'student') && (
                <div style={{ padding: '2rem' }}>
                  <button 
                    onClick={() => {
                      if (!user) {
                        // Redirect to login if not logged in
                        navigate('/login')
                      } else {
                        // Show enrollment modal if logged in but not a student
                        setShowEnrollModal(true)
                        setEnrollStep(1)
                      }
                    }} 
                    style={{
                      width: '100%',
                      padding: '1.5rem 2rem',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '1rem',
                      cursor: 'pointer',
                      boxShadow: '0 10px 30px rgba(124, 52, 217, 0.35)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                      e.currentTarget.style.boxShadow = '0 15px 40px rgba(124, 52, 217, 0.45)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)'
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(124, 52, 217, 0.35)'
                    }}
                  >
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      opacity: 0.9,
                      letterSpacing: '0.5px'
                    }}>
                      {!user ? 'سجل الدخول للتسجيل' : 'سجل الآن مقابل'}
                    </span>
                    <span style={{
                      fontSize: '2rem',
                      fontWeight: 900,
                      lineHeight: 1
                    }}>
                      {parseFloat(course.price).toFixed(2)} د.ت
                    </span>
                    <div style={{
                      position: 'absolute',
                      top: '-50%',
                      left: '-50%',
                      width: '200%',
                      height: '200%',
                      background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                      animation: 'shimmer 3s infinite',
                      pointerEvents: 'none'
                    }} />
                  </button>
                </div>
              )}
          </div>
        </div>
        </div>
          </div>

      {/* Video and Lessons Grid - Desktop: side by side, Mobile: stacked */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
        gap: '2rem',
        marginBottom: '2rem'
      }}
      className="course-video-lessons-grid"
      >
        {/* Video Player */}
        <div style={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <div 
            className="course-video-player"
            style={{
            background: '#111827',
            borderRadius: '1rem',
            overflow: 'hidden',
            aspectRatio: '16 / 9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            marginBottom: '2rem',
            width: '100%',
            maxWidth: '100%',
            position: 'relative'
          }}>
            {currentVideoUrl ? (
              renderLink(currentVideoUrl)
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '1.125rem' }}>▶ معاينة الدورة</div>
        )}
      </div>
      </div>

        {/* Lessons List - Sidebar */}
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          height: 'fit-content',
          position: 'sticky',
          top: '100px',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1f2937',
            marginBottom: '0.75rem'
          }}>
            محتوى الدورة
          </h2>
          
          {/* Course summary */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1.5rem',
            padding: '0.75rem',
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            color: '#6b7280',
            flexWrap: 'wrap'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📚 <strong style={{ color: '#374151' }}>{totalLessons}</strong> درس
            </span>
            {totalDurationText && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                ⏱ <strong style={{ color: '#374151' }}>{totalDurationText}</strong>
              </span>
            )}
            {course.modules && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                📂 <strong style={{ color: '#374151' }}>{course.modules.length}</strong> وحدة
              </span>
            )}
          </div>
          
          {course.modules && course.modules.length > 0 ? (
            <>
              {/* Trailer Section - Show if there are trailer lessons OR course has trailer_video_url */}
              {(course.modules.some(m => m.lessons?.some(l => l.is_trailer)) || course.trailer_video_url) && (
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                      color: 'white',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem'
                    }}>▶</span>
                    المعاينة
                  </h3>
                  
                  {/* Show trailer lessons if they exist */}
                  {course.modules.map((module) => 
                    module.lessons
                      ?.filter(lesson => lesson.is_trailer)
                      .map((lesson) => {
                        const trailerDuration = formatDuration(lesson.duration)
                        return (
                        <div
                          key={lesson.id}
                          onClick={() => handleLessonClick(lesson.id)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            background: activeLesson === lesson.id ? '#e0edff' : '#f9fafb',
                            color: activeLesson === lesson.id ? '#2563eb' : '#1f2937',
                            transition: 'all 0.2s',
                            border: activeLesson === lesson.id ? '2px solid #2563eb' : '2px solid #e5e7eb',
                            fontWeight: activeLesson === lesson.id ? 600 : 500
                          }}
                          onMouseEnter={(e) => {
                            if (activeLesson !== lesson.id) {
                              e.currentTarget.style.background = '#f3f4f6'
                              e.currentTarget.style.borderColor = '#d1d5db'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (activeLesson !== lesson.id) {
                              e.currentTarget.style.background = '#f9fafb'
                              e.currentTarget.style.borderColor = '#e5e7eb'
                            }
                          }}
                        >
                          <span style={{ flex: 1 }}>▶ {lesson.title}</span>
                          {trailerDuration && (
                            <span style={{ 
                              color: activeLesson === lesson.id ? '#2563eb' : '#6b7280', 
                              fontSize: '12px',
                              background: activeLesson === lesson.id ? '#dbeafe' : '#e5e7eb',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                              fontWeight: 500
                            }}>
                              ⏱ {trailerDuration}
                            </span>
                          )}
          </div>
                        )
                      })
        )}

                  {/* Show course trailer_video_url if no trailer lessons exist */}
                  {!course.modules.some(m => m.lessons?.some(l => l.is_trailer)) && course.trailer_video_url && (
                    <div
                      onClick={() => handleLessonClick('trailer')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        background: activeLesson === 'trailer' ? '#e0edff' : '#f9fafb',
                        color: activeLesson === 'trailer' ? '#2563eb' : '#1f2937',
                        transition: 'all 0.2s',
                        border: activeLesson === 'trailer' ? '2px solid #2563eb' : '2px solid #e5e7eb',
                        fontWeight: activeLesson === 'trailer' ? 600 : 500
                      }}
                      onMouseEnter={(e) => {
                        if (activeLesson !== 'trailer') {
                          e.currentTarget.style.background = '#f3f4f6'
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeLesson !== 'trailer') {
                          e.currentTarget.style.background = '#f9fafb'
                          e.currentTarget.style.borderColor = '#e5e7eb'
                        }
                      }}
                    >
                      <span>▶ معاينة الدورة</span>
                    </div>
                  )}
                </div>
              )}

              {/* Regular Lessons */}
              {course.modules.map((module, moduleIndex) => {
                const regularLessons = module.lessons?.filter(lesson => !lesson.is_trailer) || []
                if (regularLessons.length === 0) return null
                
                const lessonOffset = course.modules
                  .slice(0, moduleIndex)
                  .reduce((acc, m) => acc + (m.lessons?.filter(l => !l.is_trailer).length || 0), 0)
                
                // Calculate module duration
                const moduleDurationSeconds = module.lessons?.reduce((acc, l) => acc + (l.duration || 0), 0) || 0
                const moduleDurationText = formatDuration(moduleDurationSeconds)
                
                return (
                  <div key={module.id} style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem'
                    }}>
                    <h3 style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#1f2937',
                        margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{
                        background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                        color: 'white',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {moduleIndex + 1}
                      </span>
                      {module.title}
                    </h3>
                      {moduleDurationText && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontFamily: 'monospace',
                          background: '#f3f4f6',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {moduleDurationText}
                        </span>
                      )}
                    </div>
                    {regularLessons.map((lesson, lessonIndex) => {
                      const lessonNumber = lessonOffset + lessonIndex + 1
                      return (
                      <LessonItem 
                        key={lesson.id} 
                        lesson={lesson} 
                        canAccess={canAccessContent}
                        isActive={activeLesson === lesson.id}
                        lessonNumber={lessonNumber}
                        onLessonClick={(lessonId) => handleLessonClick(lessonId)}
                        onEnrollClick={() => {
                          if (!user) {
                            navigate('/login')
                          } else {
                          setShowEnrollModal(true)
                          setEnrollStep(1)
                          }
                        }}
                      />
                      )
                    })}
                </div>
                )
              })}
            </>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
              لا توجد دروس متاحة
            </p>
          )}
              </div>
              </div>

      {/* Rating and Like Section */}
      {user?.role === 'student' && canAccessContent && (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          gap: '2rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: '0.75rem'
            }}>
              قيم هذه الدورة
            </h3>
            <div style={{
              display: 'flex',
              gap: '0.25rem',
              marginBottom: '0.5rem'
            }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.75rem',
                    cursor: 'pointer',
                    padding: 0,
                    filter: userRating && userRating >= star ? 'grayscale(0%)' : 'grayscale(100%)',
                    opacity: userRating && userRating >= star ? 1 : 0.4
                  }}
                >
                  ⭐
                </button>
            ))}
          </div>
            {userRating && (
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
                قيمت بـ {userRating} نجوم
              </p>
        )}
      </div>

          <div>
            <button 
              onClick={handleLike}
              style={{
                background: isLiked ? '#fef2f2' : 'white',
                border: `2px solid ${isLiked ? '#ef4444' : '#e5e7eb'}`,
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: isLiked ? '#dc2626' : '#6b7280',
                fontWeight: 600
              }}
            >
              {isLiked ? '❤️' : '🤍'} {courseStats?.likesCount || 0} إعجاب
            </button>
              </div>
        </div>
      )}

      {/* Comments Section - At the bottom */}
      <div style={{
        marginTop: '2rem'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#1f2937',
          marginBottom: '1.5rem'
        }}>
          التعليقات ({courseStats?.commentsCount || 0})
        </h2>
        
        {user?.role === 'student' && canAccessContent && (
          <form onSubmit={handleCommentSubmit} style={{ marginBottom: '2rem' }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="اكتب تعليقاً..."
              rows="4"
                  required
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '1rem'
              }}
            />
            <button type="submit" className="btn-gradient" style={{ 
              padding: '0.75rem 2rem',
              fontSize: '1rem'
            }}>
              نشر التعليق
            </button>
          </form>
        )}
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {comments.length === 0 ? (
            <p style={{
              textAlign: 'center',
              color: '#9ca3af',
              padding: '3rem',
              fontSize: '1rem',
              fontStyle: 'italic'
            }}>
              لا توجد تعليقات بعد. كن أول من يعلق!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} style={{
                background: 'white',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  marginBottom: '0.75rem'
                }}>
                  <img 
                    src={comment.profiles?.profile_image_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(comment.profiles?.name || 'User') + '&background=7C34D9&color=fff'} 
                    alt={comment.profiles?.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      background: '#e5e7eb',
                      flexShrink: 0
                    }}
                    onError={(e) => {
                      e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(comment.profiles?.name || 'User') + '&background=7C34D9&color=fff'
                      e.target.onerror = null
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.25rem'
                    }}>
                      <strong style={{
                        fontSize: '1rem',
                        color: '#1f2937',
                        fontWeight: 600
                      }}>{comment.profiles?.name || 'مجهول'}</strong>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {user?.id === comment.user_id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              padding: '0.25rem 0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            حذف
                          </button>
                        )}
                        {user?.id && user.id !== comment.user_id && (
                          <button
                            onClick={() => handleReport('course_comment', comment.id)}
                            style={{
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '0.375rem',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              color: '#6b7280'
                            }}
                          >
                            🚩 إبلاغ
                          </button>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af'
                    }}>
                      {new Date(comment.created_at).toLocaleDateString('ar-TN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
                <p style={{
                  margin: 0,
                  color: '#4b5563',
                  fontSize: '1rem',
                  lineHeight: '1.6'
                }}>{comment.comment}</p>
              </div>
            ))
          )}
        </div>
              </div>
              
      {/* Enrollment Modal */}
      {showEnrollModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => !submitting && setShowEnrollModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step Indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              position: 'relative'
            }}>
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: enrollStep >= 1 ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#e5e7eb',
                  color: enrollStep >= 1 ? 'white' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}>
                  1
                </div>
                <div style={{
                  flex: 1,
                  height: '3px',
                  background: enrollStep >= 2 ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#e5e7eb',
                  borderRadius: '2px'
                }} />
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: enrollStep >= 2 ? 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)' : '#e5e7eb',
                  color: enrollStep >= 2 ? 'white' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}>
                  2
                </div>
              </div>
            </div>

            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 900,
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              {enrollStep === 1 ? 'اختر طريقة الدفع' : 'أرسل إثبات الدفع'}
            </h2>
            <p style={{
              color: '#6b7280',
              fontSize: '0.875rem',
              marginBottom: '2rem'
            }}>
              {enrollStep === 1 ? 'اختر طريقة الدفع المناسبة لك' : 'قم برفع إثبات الدفع لإتمام عملية التسجيل'}
            </p>

            {/* Step 1: Choose Payment Method */}
            {enrollStep === 1 && (
              <div>
                {/* Course Details Section */}
                {course && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    border: '2px solid #e5e7eb',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      marginBottom: '1rem',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <h3 style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#1f2937',
                          marginBottom: '0.5rem',
                          lineHeight: '1.4'
                        }}>
                          {course.title}
                        </h3>
                        {course.description && (
                          <p style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            lineHeight: '1.6',
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {course.description}
                          </p>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '0.5rem',
                        flexShrink: 0
                      }}>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          السعر
                        </div>
                        <div style={{
                          fontSize: '2rem',
                          fontWeight: 900,
                          background: 'linear-gradient(135deg, #7C34D9 0%, #F48434 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          lineHeight: '1'
                        }}>
                          {parseFloat(course.price || 0).toFixed(2)} د.ت
                        </div>
                      </div>
                    </div>
                    {course.creator_name && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e5e7eb',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        <span>👤</span>
                        <span>المنشئ: <strong style={{ color: '#374151' }}>{course.creator_name}</strong></span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem'
                }}>
                  {[
                    { value: 'bank', label: 'تحويل بنكي', icon: '🏦' },
                    { value: 'mobile', label: 'دفع محمول', icon: '📱' },
                    { value: 'cash', label: 'نقدي', icon: '💵' },
                    { value: 'dodo', label: 'VISA/MASTERCARD', icon: '💳', description: 'دفع دولي' }
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      style={{
                        padding: '1.5rem 1rem',
                        border: paymentMethod === method.value ? '2px solid #7C34D9' : '2px solid #e5e7eb',
                        borderRadius: '0.75rem',
                        background: paymentMethod === method.value ? '#f3f4f6' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (paymentMethod !== method.value) {
                          e.currentTarget.style.borderColor = '#d1d5db'
                          e.currentTarget.style.background = '#f9fafb'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (paymentMethod !== method.value) {
                          e.currentTarget.style.borderColor = '#e5e7eb'
                          e.currentTarget.style.background = 'white'
                        }
                      }}
                    >
                      <span style={{ fontSize: '2rem' }}>{method.icon}</span>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: paymentMethod === method.value ? 700 : 500,
                        color: '#1f2937'
                      }}>
                        {method.label}
                      </span>
                      {method.description && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontWeight: 400
                        }}>
                          {method.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div style={{
                  background: '#f9fafb',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '2rem',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '0.5rem'
                  }}>
                    💡 ملاحظة:
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#374151',
                    lineHeight: '1.6'
                  }}>
                    {paymentMethod === 'dodo' 
                      ? 'سيتم توجيهك إلى صفحة الدفع الآمنة لإتمام عملية الدفع'
                      : 'بعد اختيار طريقة الدفع، ستتمكن من رفع إثبات الدفع في الخطوة التالية'}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'flex-end'
                }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowEnrollModal(false)
                      setEnrollStep(1)
                    }} 
                    className="btn-secondary"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="button" 
                    onClick={handleEnrollStep1}
                    className="btn-gradient"
                    style={{ padding: '0.75rem 2rem' }}
                    disabled={submitting}
                  >
                    {submitting ? 'جاري التحميل...' : (paymentMethod === 'dodo' ? 'الانتقال إلى الدفع' : 'التالي')}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Upload Receipt */}
            {enrollStep === 2 && (
              <form onSubmit={(e) => {
                e.preventDefault()
                handleEnrollSubmit()
              }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}>
                    طريقة الدفع المختارة
                  </label>
                  <div style={{
                    padding: '1rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9375rem',
                    color: '#1f2937',
                    fontWeight: 500
                  }}>
                    {paymentMethod === 'bank' && '🏦 تحويل بنكي'}
                    {paymentMethod === 'mobile' && '📱 دفع محمول'}
                    {paymentMethod === 'cash' && '💵 نقدي'}
                    {paymentMethod === 'dodo' && '💳 VISA/MASTERCARD'}
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}>
                    إثبات الدفع *
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPaymentFile(e.target.files[0])}
                  required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  />
                  {paymentFile && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      color: '#166534'
                    }}>
                      ✓ تم اختيار الملف: {paymentFile.name}
                    </div>
                )}
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginTop: '0.5rem'
                  }}>
                    يمكنك رفع صورة أو ملف PDF لإثبات الدفع
                  </p>
              </div>
              
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}>
                    ملاحظات (اختياري)
                  </label>
                <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  rows="3"
                    placeholder="أي معلومات إضافية عن الدفع..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                />
              </div>
              
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'flex-end'
                }}>
                <button 
                  type="button" 
                    onClick={() => setEnrollStep(1)} 
                  className="btn-secondary"
                  disabled={submitting}
                >
                    رجوع
                </button>
                  <button 
                    type="submit" 
                    className="btn-gradient"
                    disabled={submitting || !paymentFile}
                    style={{ padding: '0.75rem 2rem' }}
                  >
                    {submitting ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CourseDetail
