import { useState, useEffect, useRef, useCallback } from 'react'
import { generatePlaybackUrl } from '../lib/bunnyStream'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * Secure Bunny Stream Video Player
 * - Fetches signed embed URLs for authenticated video playback
 * - Supports "Embed view token authentication" in Bunny Stream
 * - Simple fade in/out watermark for anti-piracy
 * - Custom fullscreen that preserves watermarks
 */
export default function SecureBunnyPlayer({ 
  videoId, 
  lessonId, 
  requireAuth = true,
  fallbackUrl = null,
  style = {}
}) {
  const { user } = useAuth()
  const containerRef = useRef(null)
  const [signedUrl, setSignedUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [watermarkCode, setWatermarkCode] = useState(null)
  const [movingWatermarkPosition, setMovingWatermarkPosition] = useState({ x: 50, y: 50 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRecordingDetected, setIsRecordingDetected] = useState(false)
  const [showControls, setShowControls] = useState(false)
  
  const libraryId = import.meta.env.VITE_BUNNY_STREAM_LIBRARY_ID || '580416'
  
  // Fetch watermark_code from user profile
  useEffect(() => {
    if (!user?.id) {
      setWatermarkCode(null)
      return
    }
    
    const fetchWatermarkCode = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('watermark_code')
          .eq('id', user.id)
          .single()
        
        if (error) {
          console.warn('[SecureBunnyPlayer] Error fetching watermark_code:', error)
          // Fallback: use first 8 chars of user ID
          const fallbackCode = user.id.substring(0, 8).toUpperCase()
          setWatermarkCode(fallbackCode)
        } else {
          const code = data?.watermark_code || user.id.substring(0, 8).toUpperCase()
          setWatermarkCode(code)
        }
      } catch (err) {
        console.warn('[SecureBunnyPlayer] Error fetching watermark_code:', err)
        setWatermarkCode(user.id.substring(0, 8).toUpperCase())
      }
    }
    
    fetchWatermarkCode()
  }, [user?.id])
  
  // Move watermark every 5 seconds to random position
  useEffect(() => {
    if (!watermarkCode) return
    
    // Random positions around the video
    const positions = [
      { x: 20, y: 20 },   // Top-left
      { x: 80, y: 20 },   // Top-right
      { x: 20, y: 80 },   // Bottom-left
      { x: 80, y: 80 },   // Bottom-right
      { x: 15, y: 50 },   // Left
      { x: 85, y: 50 },   // Right
      { x: 50, y: 15 },   // Top
      { x: 50, y: 85 },   // Bottom
      { x: 30, y: 30 },   // Top-left area
      { x: 70, y: 30 },   // Top-right area
      { x: 30, y: 70 },   // Bottom-left area
      { x: 70, y: 70 }    // Bottom-right area
    ]
    
    const getRandomPosition = () => positions[Math.floor(Math.random() * positions.length)]
    
    // Set initial position
    setMovingWatermarkPosition(getRandomPosition())
    
    // Move every 5 seconds
    const interval = setInterval(() => {
      setMovingWatermarkPosition(getRandomPosition())
    }, 5000) // 5 seconds
    
    return () => clearInterval(interval)
  }, [watermarkCode])
  
  
  // Fullscreen handling
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])
  
  // Keyboard shortcuts for fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      }
      if (e.key === 'Escape' && isFullscreen) {
        // Let browser handle Escape
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFullscreen, isFullscreen])
  
  // Screen recording detection
  useEffect(() => {
    // Detect Picture-in-Picture mode
    const handlePipEnter = () => {
      console.warn('[SecureBunnyPlayer] PiP mode detected - possible screen recording')
      setIsRecordingDetected(true)
    }
    
    const handlePipExit = () => {
      setIsRecordingDetected(false)
    }
    
    document.addEventListener('enterpictureinpicture', handlePipEnter)
    document.addEventListener('leavepictureinpicture', handlePipExit)
    
    // Detect when page loses visibility (might indicate screen sharing/recording)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[SecureBunnyPlayer] Page hidden - user switched away')
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Detect DevTools open (might indicate inspection)
    const detectDevTools = () => {
      const threshold = 160
      const widthDiff = window.outerWidth - window.innerWidth
      const heightDiff = window.outerHeight - window.innerHeight
      
      if (widthDiff > threshold || heightDiff > threshold) {
        console.log('[SecureBunnyPlayer] DevTools may be open')
      }
    }
    
    window.addEventListener('resize', detectDevTools)
    
    return () => {
      document.removeEventListener('enterpictureinpicture', handlePipEnter)
      document.removeEventListener('leavepictureinpicture', handlePipExit)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', detectDevTools)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    
    const fetchSignedUrl = async () => {
      if (!videoId || !lessonId) {
        // Use fallback or unsigned URL if no lesson ID
        if (fallbackUrl) {
          setSignedUrl(fallbackUrl)
        } else if (videoId) {
          // Use unsigned embed URL (for trailers/previews)
          setSignedUrl(`https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`)
        }
        setLoading(false)
        return
      }
      
      if (!requireAuth) {
        // Use unsigned URL if auth not required
        setSignedUrl(`https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`)
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        setError(null)
        
        // Get device fingerprint for tracking
        const deviceId = getDeviceFingerprint()
        
        // Call Edge Function to get signed URL
        const result = await generatePlaybackUrl(videoId, lessonId, deviceId)
        
        if (isMounted && result.embed_url) {
          console.log('[SecureBunnyPlayer] Got signed URL:', result.embed_url)
          setSignedUrl(result.embed_url)
        } else if (isMounted) {
          throw new Error('No embed URL returned')
        }
      } catch (err) {
        console.error('[SecureBunnyPlayer] Error fetching signed URL:', err)
        if (isMounted) {
          setError(err.message)
          
          // Use fallback URL on error (but this won't work with token auth enabled)
          if (fallbackUrl) {
            setSignedUrl(fallbackUrl)
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    
    fetchSignedUrl()
    
    return () => {
      isMounted = false
    }
  }, [videoId, lessonId, requireAuth, fallbackUrl, retryCount, libraryId])
  
  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }
  
  // Common watermark styles
  const watermarkBaseStyle = {
    position: 'absolute',
    pointerEvents: 'none',
    userSelect: 'none',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'all 0.3s ease'
  }
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: '300px',
        background: '#111827',
        color: '#9ca3af',
        ...style
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #374151',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p>جاري تحميل الفيديو...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }
  
  if (error && !signedUrl) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: '300px',
        background: '#111827',
        color: '#f87171',
        flexDirection: 'column',
        gap: '12px',
        ...style
      }}>
        <p>خطأ في تحميل الفيديو</p>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>{error}</p>
        <button
          onClick={handleRetry}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }
  
  if (!signedUrl) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: '300px',
        background: '#111827',
        color: '#9ca3af',
        ...style
      }}>
        <p>لا يوجد فيديو متاح</p>
      </div>
    )
  }
  
  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '100%',
        background: '#111827',
        overflow: 'hidden',
        ...style
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video iframe */}
      <iframe
        src={signedUrl}
        loading="lazy"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none'
        }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media"
        // Remove allowFullScreen to force users to use our fullscreen button
      />
      
      {/* Custom Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        style={{
          position: 'absolute',
          bottom: isFullscreen ? '20px' : '10px',
          right: isFullscreen ? '20px' : '10px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: isFullscreen ? '12px 16px' : '8px 12px',
          cursor: 'pointer',
          zIndex: 30,
          fontSize: isFullscreen ? '16px' : '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: showControls || isFullscreen ? 1 : 0.3,
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(4px)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)'}
        title={isFullscreen ? 'خروج من ملء الشاشة (Esc)' : 'ملء الشاشة (F)'}
      >
        {isFullscreen ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
            خروج
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            ملء الشاشة
          </>
        )}
      </button>
      
      {/* 1. Bottom Center Watermark - OBVIOUS (high opacity) - Raised up more */}
      {watermarkCode && (
        <div
          style={{
            ...watermarkBaseStyle,
            left: '50%',
            bottom: '50px', // Raised up more (was 15px)
            transform: 'translateX(-50%)',
            zIndex: 9999,
            opacity: 0.4, // Obvious - 40% opacity
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: isFullscreen ? '20px' : '16px',
            letterSpacing: '2px',
            textShadow: '0 0 12px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none'
          }}
        >
          {watermarkCode}
        </div>
      )}
      
      {/* 2. Center Watermark - Low opacity (always visible) - More visible */}
      {watermarkCode && (
        <div
          style={{
            ...watermarkBaseStyle,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotate(-5deg)',
            zIndex: 9998,
            opacity: 0.18, // More visible - 18% (was 8%)
            color: 'rgba(255, 255, 255, 0.18)',
            fontSize: isFullscreen ? '36px' : '28px',
            letterSpacing: '3px',
            textShadow: '0 0 15px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none'
          }}
        >
          {watermarkCode}
        </div>
      )}
      
      {/* 3. Moving Watermark - Low opacity (moves every 5 seconds) - More visible */}
      {watermarkCode && (
        <div
          key={`moving-${movingWatermarkPosition.x}-${movingWatermarkPosition.y}`}
          style={{
            ...watermarkBaseStyle,
            left: `${movingWatermarkPosition.x}%`,
            top: `${movingWatermarkPosition.y}%`,
            transform: 'translate(-50%, -50%) rotate(-10deg)',
            zIndex: 9997,
            opacity: 0.22, // More visible - 22% (was 12%)
            color: 'rgba(255, 255, 255, 0.22)',
            fontSize: isFullscreen ? '18px' : '14px',
            letterSpacing: '2px',
            textShadow: '0 0 12px rgba(0,0,0,0.6), 0 0 6px rgba(0,0,0,0.4)',
            transition: 'all 0.8s ease-in-out', // Smooth movement
            pointerEvents: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none'
          }}
        >
          {watermarkCode}
        </div>
      )}
      
      {/* Recording Warning Banner */}
      {isRecordingDetected && (
        <div
          style={{
            position: 'absolute',
            top: isFullscreen ? '20px' : '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(220, 38, 38, 0.95)',
            color: 'white',
            padding: isFullscreen ? '12px 24px' : '8px 16px',
            borderRadius: '8px',
            fontSize: isFullscreen ? '16px' : '12px',
            fontWeight: 'bold',
            zIndex: 25,
            pointerEvents: 'none',
            animation: 'pulse 1s infinite',
            boxShadow: '0 4px 20px rgba(220, 38, 38, 0.5)'
          }}
        >
          ⚠️ تم اكتشاف نشاط مشبوه - جميع الأنشطة مسجلة
        </div>
      )}
      
      {/* Fullscreen Indicator */}
      {isFullscreen && showControls && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            zIndex: 20,
            pointerEvents: 'none'
          }}
        >
          اضغط ESC أو F للخروج من ملء الشاشة
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}

/**
 * Generate a simple device fingerprint for tracking
 */
function getDeviceFingerprint() {
  const nav = window.navigator
  const screen = window.screen
  
  const data = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset()
  ].join('|')
  
  // Simple hash
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  
  return Math.abs(hash).toString(16)
}
