/**
 * Bunny Stream Video Player Component
 * Displays videos with watermark overlay, anti-piracy measures, and session validation
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { generatePlaybackUrl, logVideoEvent, generateWatermarkCode } from '../lib/bunnyStream'
import { generateDeviceId } from '../lib/deviceFingerprint'
import { useAuth } from '../context/AuthContext'

/**
 * BunnyPlayer Component with Enhanced Security
 * 
 * @param {string} videoId - Bunny Stream video ID
 * @param {string} lessonId - Lesson ID
 * @param {string} watermarkCode - Watermark code to display (e.g., UID-ABC123-DEF456)
 * @param {boolean} autoPlay - Whether to autoplay the video
 * @param {string} className - Additional CSS classes
 * @param {object} style - Additional inline styles
 * @param {boolean} enableScreenCaptureDetection - Enable anti-screen-capture detection
 */
export default function BunnyPlayer({ 
  videoId, 
  lessonId, 
  watermarkCode, 
  autoPlay = false,
  className = '',
  style = {},
  enableScreenCaptureDetection = true
}) {
  const { user } = useAuth()
  const [playbackUrl, setPlaybackUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [watermarkPosition, setWatermarkPosition] = useState({ top: 20, left: 20 })
  const [isScreenCapturing, setIsScreenCapturing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const playerRef = useRef(null)
  const containerRef = useRef(null)
  const watermarkAnimationRef = useRef(null)

  // Anti-screen-capture detection
  useEffect(() => {
    if (!enableScreenCaptureDetection) return

    // Detect visibility change (often triggered by screen capture tools)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Pause video when tab is hidden (potential screen recording)
        if (playerRef.current && !playerRef.current.paused) {
          playerRef.current.pause()
          logSecurityEvent('VISIBILITY_HIDDEN')
        }
      }
    }

    // Detect window blur (potential screen capture)
    const handleBlur = () => {
      // Log but don't pause - could be false positive
      logSecurityEvent('WINDOW_BLUR')
    }

    // Detect Picture-in-Picture mode
    const handlePipEnter = () => {
      logSecurityEvent('PIP_ENTER')
    }

    // Prevent context menu (right-click)
    const handleContextMenu = (e) => {
      if (containerRef.current?.contains(e.target)) {
        e.preventDefault()
        return false
      }
    }

    // Prevent keyboard shortcuts for screenshots
    const handleKeyDown = (e) => {
      // Print Screen, Windows+Print Screen, etc.
      if (e.key === 'PrintScreen' || 
          (e.key === 's' && (e.ctrlKey || e.metaKey)) ||
          (e.key === 'S' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        if (containerRef.current?.contains(e.target)) {
          e.preventDefault()
          logSecurityEvent('SCREENSHOT_ATTEMPT')
          return false
        }
      }
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    // PIP detection
    if (playerRef.current) {
      playerRef.current.addEventListener('enterpictureinpicture', handlePipEnter)
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      if (playerRef.current) {
        playerRef.current.removeEventListener('enterpictureinpicture', handlePipEnter)
      }
    }
  }, [enableScreenCaptureDetection])

  // Log security events
  const logSecurityEvent = useCallback(async (eventType) => {
    if (user?.id && lessonId) {
      const deviceId = generateDeviceId()
      try {
        await logVideoEvent(user.id, lessonId, deviceId, eventType)
      } catch (e) {
        console.warn('Failed to log security event:', e)
      }
    }
  }, [user?.id, lessonId])

  useEffect(() => {
    if (!videoId || !lessonId || !user?.id) {
      setError('معرفات الفيديو أو المستخدم مفقودة')
      setLoading(false)
      return
    }

    loadVideoUrl()

    // Cleanup on unmount
    return () => {
      if (watermarkAnimationRef.current) {
        cancelAnimationFrame(watermarkAnimationRef.current)
      }
    }
  }, [videoId, lessonId, user?.id])

  // Animated watermark for anti-piracy
  useEffect(() => {
    if (playbackUrl && containerRef.current) {
      const startTime = Date.now()
      const duration = 30000 // 30 seconds for a full cycle
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) % duration
        const progress = elapsed / duration
        
        // Move in a figure-8 pattern (subtle, non-intrusive)
        const container = containerRef.current
        if (container) {
          const containerWidth = container.offsetWidth
          const containerHeight = container.offsetHeight
          
          // Calculate position (staying away from edges)
          const margin = 40
          const moveWidth = containerWidth - 200 - (margin * 2)
          const moveHeight = containerHeight - 60 - (margin * 2)
          
          const x = margin + (Math.sin(progress * Math.PI * 2) * moveWidth * 0.3)
          const y = margin + (Math.cos(progress * Math.PI * 4) * moveHeight * 0.2)
          
          setWatermarkPosition({
            top: Math.max(margin, Math.min(containerHeight - 60 - margin, y)),
            left: Math.max(margin, Math.min(containerWidth - 200 - margin, x))
          })
        }
        
        watermarkAnimationRef.current = requestAnimationFrame(animate)
      }
      
      animate()
    }
  }, [playbackUrl])

  const loadVideoUrl = async () => {
    try {
      setLoading(true)
      setError(null)

      const deviceId = generateDeviceId()
      
      // Generate tokenized playback URL
      const result = await generatePlaybackUrl(videoId, user.id, lessonId, deviceId)
      setPlaybackUrl(result.playback_url)

      // Log video view event
      await logVideoEvent(user.id, lessonId, deviceId, 'VIDEO_VIEW')

      setLoading(false)
    } catch (err) {
      console.error('Error loading video URL:', err)
      setError(err.message || 'خطأ في تحميل الفيديو')
      setLoading(false)
    }
  }

  const handlePlay = async () => {
    setIsPlaying(true)
    if (user?.id && lessonId) {
      const deviceId = generateDeviceId()
      await logVideoEvent(user.id, lessonId, deviceId, 'VIDEO_PLAY')
    }
  }

  const handlePause = async () => {
    setIsPlaying(false)
    if (user?.id && lessonId) {
      const deviceId = generateDeviceId()
      await logVideoEvent(user.id, lessonId, deviceId, 'VIDEO_PAUSE')
    }
  }

  const handleEnded = async () => {
    setIsPlaying(false)
    if (user?.id && lessonId) {
      const deviceId = generateDeviceId()
      await logVideoEvent(user.id, lessonId, deviceId, 'VIDEO_COMPLETED')
    }
  }

  const handleError = async (e) => {
    console.error('Video player error:', e)
    setError('حدث خطأ أثناء تشغيل الفيديو')
    
    if (user?.id && lessonId) {
      const deviceId = generateDeviceId()
      await logVideoEvent(user.id, lessonId, deviceId, 'VIDEO_ERROR')
    }
  }

  // Generate watermark code if not provided
  const displayWatermarkCode = watermarkCode || (user?.id ? generateWatermarkCode(user.id, generateDeviceId()) : 'USER-UNKNOWN')

  // Get current timestamp for watermark
  const getTimestamp = () => {
    return new Date().toLocaleTimeString('en-US', { hour12: false })
  }

  if (loading) {
    return (
      <div 
        className={`bunny-player-loading ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          ...style
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem' }}>⏳</div>
          <div>جاري تحميل الفيديو...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        className={`bunny-player-error ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          ...style
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>⚠️</div>
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>خطأ في تحميل الفيديو</div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{error}</div>
          <button
            onClick={loadVideoUrl}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#7C34D9',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  if (!playbackUrl) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`bunny-player-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        background: '#000',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        // Anti-screen-capture CSS
        WebkitUserSelect: 'none',
        userSelect: 'none',
        ...style
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Video Player */}
      <video
        ref={playerRef}
        src={playbackUrl}
        controls
        autoPlay={autoPlay}
        playsInline
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />

      {/* Primary Watermark Overlay - Moving */}
      {displayWatermarkCode && (
        <div
          className="bunny-player-watermark"
          style={{
            position: 'absolute',
            top: `${watermarkPosition.top}px`,
            left: `${watermarkPosition.left}px`,
            padding: '0.5rem 0.75rem',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 10,
            transition: 'top 0.5s ease-out, left 0.5s ease-out',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          {displayWatermarkCode}
        </div>
      )}

      {/* Secondary Watermark - Fixed Bottom Right */}
      {isPlaying && displayWatermarkCode && (
        <div
          className="bunny-player-watermark-fixed"
          style={{
            position: 'absolute',
            bottom: '50px',
            right: '20px',
            padding: '0.25rem 0.5rem',
            background: 'rgba(0, 0, 0, 0.4)',
            color: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '0.25rem',
            fontSize: '0.625rem',
            fontWeight: 500,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 10,
          }}
        >
          {displayWatermarkCode} | {getTimestamp()}
        </div>
      )}

      {/* Invisible Watermark Grid - For forensic identification */}
      <div
        className="bunny-player-forensic-watermark"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 5,
          opacity: 0.02,
          background: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 100px,
            rgba(255, 255, 255, 0.1) 100px,
            rgba(255, 255, 255, 0.1) 101px
          )`,
        }}
      >
        {/* Hidden text watermark - barely visible but shows in screenshots */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '3rem',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.03)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.5rem',
          }}
        >
          {displayWatermarkCode}
        </div>
      </div>

      {/* Screen Capture Warning Overlay */}
      {isScreenCapturing && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div style={{ textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>تم اكتشاف محاولة تسجيل الشاشة</div>
            <div style={{ marginTop: '0.5rem', color: '#9ca3af' }}>هذا المحتوى محمي</div>
          </div>
        </div>
      )}
    </div>
  )
}

