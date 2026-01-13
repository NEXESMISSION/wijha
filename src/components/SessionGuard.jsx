import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import SessionBlockingOverlay from './SessionBlockingOverlay'

/**
 * SessionGuard Component
 * 
 * Monitors session validity and displays logout messages
 * when sessions are replaced by another device
 * Blocks all interactions when session is invalid
 */
export default function SessionGuard({ children }) {
  // Safely get auth context - handle case where it might not be ready
  let logoutMessage, clearLogoutMessage, isSessionInvalid, user
  let showWarning
  try {
    const auth = useAuth()
    logoutMessage = auth.logoutMessage
    clearLogoutMessage = auth.clearLogoutMessage
    isSessionInvalid = auth.isSessionInvalid
    user = auth.user
  } catch (err) {
    // Auth context not ready yet - return children without guard
    console.warn('[SessionGuard] Auth context not ready:', err)
    return <>{children}</>
  }
  
  try {
    const alert = useAlert()
    showWarning = alert.showWarning
  } catch (err) {
    console.warn('[SessionGuard] Alert context not ready:', err)
    showWarning = () => {}
  }
  
  const navigate = useNavigate()
  const location = useLocation()
  const hasShownMessage = useRef(false)
  const lastLogoutMessage = useRef(null)

  // Show logout message if session was replaced
  // Note: Logout is already handled in AuthContext, we just show the message and redirect
  useEffect(() => {
    // Don't show logout message on login/signup pages (user is already logging in)
    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
    
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

