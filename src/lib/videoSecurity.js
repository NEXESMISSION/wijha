/**
 * Video Security Utilities
 * Anti-piracy, watermarking, and access control for video content
 */

import { supabase } from './supabase'
import { generateDeviceId } from './deviceFingerprint'

/**
 * Video Security Event Types
 */
export const VIDEO_SECURITY_EVENTS = {
  VIDEO_VIEW: 'VIDEO_VIEW',
  VIDEO_PLAY: 'VIDEO_PLAY',
  VIDEO_PAUSE: 'VIDEO_PAUSE',
  VIDEO_COMPLETED: 'VIDEO_COMPLETED',
  VIDEO_ERROR: 'VIDEO_ERROR',
  SCREENSHOT_ATTEMPT: 'SCREENSHOT_ATTEMPT',
  PIP_ENTER: 'PIP_ENTER',
  VISIBILITY_HIDDEN: 'VISIBILITY_HIDDEN',
  WINDOW_BLUR: 'WINDOW_BLUR',
  DEVTOOLS_OPEN: 'DEVTOOLS_OPEN',
  CONTEXT_MENU: 'CONTEXT_MENU',
  VIDEO_DOWNLOAD_ATTEMPT: 'VIDEO_DOWNLOAD_ATTEMPT',
}

/**
 * Check if DevTools is open (anti-debugging)
 * This is a heuristic method, not 100% reliable
 */
export function detectDevTools() {
  const threshold = 160
  const widthThreshold = window.outerWidth - window.innerWidth > threshold
  const heightThreshold = window.outerHeight - window.innerHeight > threshold
  
  // Check using debugger timing
  const start = performance.now()
  // eslint-disable-next-line no-debugger
  debugger // This will be slow if devtools is open
  const end = performance.now()
  const debuggerDetected = (end - start) > 100
  
  return widthThreshold || heightThreshold || debuggerDetected
}

/**
 * Log a security event to the database
 */
export async function logSecurityEvent(
  userId, 
  lessonId, 
  eventType, 
  additionalData = {}
) {
  try {
    const deviceId = generateDeviceId()
    
    await supabase.from('video_events').insert({
      student_id: userId,
      lesson_id: lessonId,
      device_id: deviceId,
      event_type: eventType,
      event_data: {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        ...additionalData
      }
    })
    
    // Also log to audit_logs for security-critical events
    if (['SCREENSHOT_ATTEMPT', 'DEVTOOLS_OPEN', 'VIDEO_DOWNLOAD_ATTEMPT'].includes(eventType)) {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: 'SECURITY_ALERT',
        resource_type: 'video',
        resource_id: lessonId,
        details: {
          alert_type: eventType,
          device_id: deviceId,
          timestamp: new Date().toISOString(),
        }
      })
    }
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

/**
 * Generate a unique fingerprint for watermarking
 */
export function generateWatermarkFingerprint(userId, sessionId) {
  const timestamp = Date.now().toString(36)
  const userPart = userId ? userId.substring(0, 8).toUpperCase() : 'UNKNOWN'
  const sessionPart = sessionId ? sessionId.substring(0, 6).toUpperCase() : 'NOSESS'
  
  return `${userPart}-${sessionPart}-${timestamp}`
}

/**
 * Initialize anti-piracy protection for the page
 */
export function initAntiPiracyProtection(options = {}) {
  const {
    onScreenshotAttempt = () => {},
    onDevToolsDetected = () => {},
    onContextMenu = () => {},
    logEvents = true,
  } = options

  // Prevent right-click on entire page (optional)
  const handleContextMenu = (e) => {
    // Only prevent on video elements
    if (e.target.tagName === 'VIDEO' || e.target.closest('.bunny-player-container')) {
      e.preventDefault()
      onContextMenu(e)
      if (logEvents) {
        logSecurityEvent(null, null, 'CONTEXT_MENU', { target: e.target.tagName })
      }
    }
  }

  // Detect keyboard shortcuts for screenshots
  const handleKeyDown = (e) => {
    // PrintScreen key
    if (e.key === 'PrintScreen') {
      e.preventDefault()
      onScreenshotAttempt(e)
      return false
    }
    
    // Ctrl/Cmd + S (Save)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      // Only prevent on video pages
      if (document.querySelector('.bunny-player-container')) {
        e.preventDefault()
        onScreenshotAttempt(e)
        return false
      }
    }
    
    // Ctrl/Cmd + Shift + I (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
      onDevToolsDetected(e)
    }
    
    // F12 (DevTools)
    if (e.key === 'F12') {
      onDevToolsDetected(e)
    }
  }

  // Prevent drag on video elements
  const handleDragStart = (e) => {
    if (e.target.tagName === 'VIDEO') {
      e.preventDefault()
      return false
    }
  }

  // Add event listeners
  document.addEventListener('contextmenu', handleContextMenu)
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('dragstart', handleDragStart)

  // Return cleanup function
  return () => {
    document.removeEventListener('contextmenu', handleContextMenu)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('dragstart', handleDragStart)
  }
}

/**
 * Check if the current domain is allowed to play videos
 */
export function isAllowedDomain(allowedDomains = []) {
  if (allowedDomains.length === 0) return true
  
  const currentDomain = window.location.hostname
  
  return allowedDomains.some(domain => {
    if (domain.startsWith('*.')) {
      // Wildcard domain
      const baseDomain = domain.substring(2)
      return currentDomain === baseDomain || currentDomain.endsWith('.' + baseDomain)
    }
    return currentDomain === domain
  })
}

/**
 * Create a secure video container with protection
 */
export function createSecureVideoContainer(videoElement) {
  // Disable right-click on video
  videoElement.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    return false
  })

  // Disable drag
  videoElement.draggable = false
  videoElement.addEventListener('dragstart', (e) => {
    e.preventDefault()
    return false
  })

  // Set secure attributes
  videoElement.setAttribute('controlsList', 'nodownload noremoteplayback')
  videoElement.setAttribute('disablePictureInPicture', 'true')
  
  // Prevent selection
  videoElement.style.userSelect = 'none'
  videoElement.style.webkitUserSelect = 'none'

  return videoElement
}

/**
 * Monitor video element for suspicious activity
 */
export function monitorVideoPlayback(videoElement, userId, lessonId) {
  if (!videoElement) return () => {}

  let playbackStartTime = null
  let totalPlaybackTime = 0

  const handlePlay = () => {
    playbackStartTime = Date.now()
    logSecurityEvent(userId, lessonId, 'VIDEO_PLAY')
  }

  const handlePause = () => {
    if (playbackStartTime) {
      totalPlaybackTime += (Date.now() - playbackStartTime) / 1000
      playbackStartTime = null
    }
    logSecurityEvent(userId, lessonId, 'VIDEO_PAUSE', { 
      totalPlaybackTime: Math.round(totalPlaybackTime) 
    })
  }

  const handleEnded = () => {
    if (playbackStartTime) {
      totalPlaybackTime += (Date.now() - playbackStartTime) / 1000
      playbackStartTime = null
    }
    logSecurityEvent(userId, lessonId, 'VIDEO_COMPLETED', { 
      totalPlaybackTime: Math.round(totalPlaybackTime),
      videoDuration: Math.round(videoElement.duration || 0)
    })
  }

  const handleSeeking = () => {
    logSecurityEvent(userId, lessonId, 'VIDEO_SEEK', {
      seekTime: Math.round(videoElement.currentTime)
    })
  }

  // Add listeners
  videoElement.addEventListener('play', handlePlay)
  videoElement.addEventListener('pause', handlePause)
  videoElement.addEventListener('ended', handleEnded)
  videoElement.addEventListener('seeking', handleSeeking)

  // Return cleanup function
  return () => {
    videoElement.removeEventListener('play', handlePlay)
    videoElement.removeEventListener('pause', handlePause)
    videoElement.removeEventListener('ended', handleEnded)
    videoElement.removeEventListener('seeking', handleSeeking)
  }
}

/**
 * Generate CSS for watermark that's hard to remove
 */
export function generateWatermarkCSS(watermarkCode) {
  return `
    .video-watermark {
      position: absolute;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.5);
      color: rgba(255, 255, 255, 0.7);
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      border-radius: 4px;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      z-index: 1000;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    }
    
    .video-watermark::before {
      content: '${watermarkCode}';
    }
    
    .video-watermark-moving {
      animation: moveWatermark 30s ease-in-out infinite;
    }
    
    @keyframes moveWatermark {
      0%, 100% { top: 10%; left: 10%; }
      25% { top: 10%; left: 70%; }
      50% { top: 70%; left: 70%; }
      75% { top: 70%; left: 10%; }
    }
  `
}


