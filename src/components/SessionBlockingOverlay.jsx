import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './SessionBlockingOverlay.css'

/**
 * SessionBlockingOverlay Component
 * 
 * Blocks all user interactions when session is invalid
 * Shows a modal overlay that cannot be dismissed
 * Prevents all keyboard, mouse, and touch events
 */
export default function SessionBlockingOverlay() {
  const { user, logoutMessage, isSessionInvalid } = useAuth()
  const navigate = useNavigate()
  const overlayRef = useRef(null)

  useEffect(() => {
    // Block all interactions when session is invalid
    if (isSessionInvalid || logoutMessage) {
      // Add class to body to block interactions
      document.body.classList.add('session-blocked')
      
      // Prevent all keyboard events
      const handleKeyDown = (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent all mouse events
      const handleMouseDown = (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent all touch events
      const handleTouchStart = (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent context menu
      const handleContextMenu = (e) => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Prevent form submissions
      const handleSubmit = (e) => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Add event listeners with capture phase to catch events early
      document.addEventListener('keydown', handleKeyDown, { capture: true, passive: false })
      document.addEventListener('mousedown', handleMouseDown, { capture: true, passive: false })
      document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false })
      document.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false })
      document.addEventListener('submit', handleSubmit, { capture: true, passive: false })

      // Redirect to login after a short delay
      const timer = setTimeout(() => {
        navigate('/login', { replace: true })
      }, 3000) // Redirect after 3 seconds
      
      return () => {
        clearTimeout(timer)
        document.body.classList.remove('session-blocked')
        document.removeEventListener('keydown', handleKeyDown, { capture: true })
        document.removeEventListener('mousedown', handleMouseDown, { capture: true })
        document.removeEventListener('touchstart', handleTouchStart, { capture: true })
        document.removeEventListener('contextmenu', handleContextMenu, { capture: true })
        document.removeEventListener('submit', handleSubmit, { capture: true })
      }
    } else {
      // Remove blocking class when session is valid
      document.body.classList.remove('session-blocked')
    }
  }, [isSessionInvalid, logoutMessage, navigate])

  // Don't show overlay if session is valid or no logout message
  if (!isSessionInvalid && !logoutMessage) {
    return null
  }

  return (
    <div 
      ref={overlayRef}
      className="session-blocking-overlay" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="session-blocked-title"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="session-blocking-content">
        <div className="session-blocking-icon">🔒</div>
        <h2 id="session-blocked-title">انتهت الجلسة</h2>
        <p>{logoutMessage || 'تم إلغاء جلستك. سيتم توجيهك إلى صفحة تسجيل الدخول.'}</p>
        <div className="session-blocking-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    </div>
  )
}

