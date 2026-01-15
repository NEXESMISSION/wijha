import { useEffect, useRef, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { AlertContext } from '../context/AlertContext'
import SessionBlockingOverlay from './SessionBlockingOverlay'

/**
 * SessionGuard Component
 * 
 * Monitors session validity and displays logout messages
 * when sessions are replaced by another device
 * Blocks all interactions when session is invalid
 */
export default function SessionGuard({ children }) {
  // Always call ALL hooks first - React requires hooks to be called in the same order every render
  // Use useContext directly instead of useAuth/useAlert to avoid throwing errors
  const auth = useContext(AuthContext)
  const alert = useContext(AlertContext)
  
  // Always call these hooks too - same order every render
  const navigate = useNavigate()
  const location = useLocation()
  
  // IMPORTANT: Call ALL useRef hooks BEFORE any conditional returns
  // React requires hooks to be called in the exact same order every render
  const hasShownMessage = useRef(false)
  const lastLogoutMessage = useRef(null)
  const isValidatingRef = useRef(false)
  
  // If auth context is not available, return children without guard
  // But all hooks have been called, so React is happy
  if (!auth) {
    return <>{children}</>
  }
  
  // Safely extract values with defaults
  const logoutMessage = auth?.logoutMessage || null
  const clearLogoutMessage = auth?.clearLogoutMessage || (() => {})
  const isSessionInvalid = auth?.isSessionInvalid || false
  const user = auth?.user || null
  const validateSession = auth?.validateSession || (async () => ({ isValid: true }))
  const showWarning = alert?.showWarning || (() => {})

  // Validate session on route changes (when user navigates between pages)
  // This ensures users are logged out immediately if another device logged in
  useEffect(() => {
    // Only validate if user is logged in and not already validating
    if (!user || isSessionInvalid || isValidatingRef.current || !validateSession) {
      return
    }

    // Skip validation on auth pages
    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
    if (isAuthPage) {
      return
    }

    // Validate session on route change using AuthContext method
    // This ensures proper state management and logout message handling
    isValidatingRef.current = true
    validateSession()
      .catch((error) => {
        // Ignore validation errors (might be temporary network issues)
        console.warn('[SessionGuard] Session validation error:', error.message)
      })
      .finally(() => {
        isValidatingRef.current = false
      })
  }, [location.pathname, user, isSessionInvalid, validateSession])

  // Validate session when page becomes visible (user switches tabs and comes back)
  useEffect(() => {
    if (!user || isSessionInvalid || !validateSession) {
      return
    }

    const handleVisibilityChange = () => {
      // Only validate when page becomes visible (not when it becomes hidden)
      if (document.visibilityState === 'visible' && !isValidatingRef.current) {
        const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
        if (isAuthPage) {
          return
        }

        isValidatingRef.current = true
        validateSession()
          .catch((error) => {
            console.warn('[SessionGuard] Session validation error on visibility change:', error.message)
          })
          .finally(() => {
            isValidatingRef.current = false
          })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, isSessionInvalid, validateSession, location.pathname])

  // Show logout message if session was replaced
  // Note: Logout is already handled in AuthContext, we just show the message and redirect
  useEffect(() => {
    // PRIORITY 1: If user is logged in, IMMEDIATELY clear any stale logout message
    // This prevents showing logout message after successful login
    if (user) {
      if (logoutMessage && clearLogoutMessage) {
        clearLogoutMessage()
      }
      hasShownMessage.current = false
      lastLogoutMessage.current = null
      return // Exit early - user is logged in, no message needed
    }
    
    // PRIORITY 2: Don't show logout message on login/signup pages (user is already logging in)
    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
    if (isAuthPage) {
      hasShownMessage.current = false
      lastLogoutMessage.current = null
      return
    }
    
    // Only show message if:
    // 1. There's a logout message
    // 2. It's a new message we haven't shown yet
    // 3. We're NOT on login/signup pages (unless user is already logged out)
    // 4. User is not logged in (to prevent showing on login page)
    if (logoutMessage && 
        logoutMessage !== lastLogoutMessage.current && 
        !hasShownMessage.current &&
        !isAuthPage &&
        !user) {
      hasShownMessage.current = true
      lastLogoutMessage.current = logoutMessage
      
      // Show the message - NO auto-close, user must click OK
      showWarning(
        logoutMessage,
        'انتهت الجلسة',
        {
          autoClose: false, // Don't auto-close - user must click OK
          onConfirm: () => {
            clearLogoutMessage()
            navigate('/login', { replace: true })
          }
        }
      )
    }
    
    // Reset flag when logoutMessage is cleared or user logs in
    if ((!logoutMessage || user) && hasShownMessage.current) {
      hasShownMessage.current = false
      lastLogoutMessage.current = null
    }
  }, [logoutMessage, clearLogoutMessage, navigate, showWarning, location.pathname, user])

  return (
    <>
      {/* Blocking overlay prevents all interactions when session is invalid */}
      <SessionBlockingOverlay />
      {children}
    </>
  )
}

