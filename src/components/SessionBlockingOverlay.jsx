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
    // PRIORITY 1: Don't block if user is logged in (even if there's a stale logout message)
    // This must be checked FIRST to prevent blocking after successful login
    if (user) {
      document.body.classList.remove('session-blocked')
      return // Exit early - user is logged in, no blocking needed
    }
    
    // PRIORITY 2: Don't block on login/signup pages
    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/signup'
    if (isAuthPage) {
      document.body.classList.remove('session-blocked')
      return // Don't block on auth pages
    }
    
    // PRIORITY 3: Block all interactions when session is invalid
    // But allow alert interactions (alert has higher z-index)
    // Only block if user is NOT logged in AND session is invalid
    if (isSessionInvalid || logoutMessage) {
      // Add class to body to block interactions
      document.body.classList.add('session-blocked')
      
      // Prevent all keyboard events (except on alert)
      const handleKeyDown = (e) => {
        // Allow if clicking on alert - check by z-index or class
        const target = e.target
        const alertElement = target.closest('.alert-overlay') || target.closest('.alert-modal') || 
                           (target.closest('[style*="z-index: 100000"]') || target.closest('[style*="zIndex: 100000"]'))
        if (alertElement) {
          return // Allow alert interactions
        }
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent all mouse events (except on alert)
      const handleMouseDown = (e) => {
        // Allow if clicking on alert - check by class or parent
        const target = e.target
        let element = target
        while (element && element !== document.body) {
          if (element.classList && (
            element.classList.contains('alert-overlay') || 
            element.classList.contains('alert-modal')
          )) {
            return // Allow alert interactions
          }
          element = element.parentElement
        }
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
      
      // Also handle click events (for buttons)
      const handleClick = (e) => {
        // Allow if clicking on alert
        const target = e.target
        let element = target
        while (element && element !== document.body) {
          if (element.classList && (
            element.classList.contains('alert-overlay') || 
            element.classList.contains('alert-modal')
          )) {
            return // Allow alert interactions
          }
          element = element.parentElement
        }
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }

      // Prevent all touch events (except on alert)
      const handleTouchStart = (e) => {
        // Allow if touching alert - check by z-index or class
        const target = e.target
        const alertElement = target.closest('.alert-overlay') || target.closest('.alert-modal') || 
                           (target.closest('[style*="z-index: 100000"]') || target.closest('[style*="zIndex: 100000"]'))
        if (alertElement) {
          return // Allow alert interactions
        }
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
      document.addEventListener('click', handleClick, { capture: true, passive: false })
      document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false })
      document.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false })
      document.addEventListener('submit', handleSubmit, { capture: true, passive: false })

      // Don't auto-redirect - wait for user to click OK on alert
      // The alert will handle navigation via onConfirm
      
      return () => {
        document.body.classList.remove('session-blocked')
        document.removeEventListener('keydown', handleKeyDown, { capture: true })
        document.removeEventListener('mousedown', handleMouseDown, { capture: true })
        document.removeEventListener('click', handleClick, { capture: true })
        document.removeEventListener('touchstart', handleTouchStart, { capture: true })
        document.removeEventListener('contextmenu', handleContextMenu, { capture: true })
        document.removeEventListener('submit', handleSubmit, { capture: true })
      }
    } else {
      // Remove blocking class when session is valid
      document.body.classList.remove('session-blocked')
    }
  }, [isSessionInvalid, logoutMessage, navigate, user])

  // PRIORITY 1: Don't show overlay if user is logged in (session is valid)
  // This prevents showing overlay during/after login when there's a stale logoutMessage
  // This check MUST be first to prevent false positives
  if (user) {
    return null
  }
  
  // PRIORITY 2: Don't show overlay on login/signup pages
  const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/signup'
  if (isAuthPage) {
    return null
  }
  
  // PRIORITY 3: Don't show overlay if session is valid and no logout message
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

