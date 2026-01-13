import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const { logoutMessage, clearLogoutMessage, isSessionInvalid } = useAuth()
  const { showWarning } = useAlert()
  const navigate = useNavigate()
  const hasShownMessage = useRef(false)
  const lastLogoutMessage = useRef(null)

  // Show logout message if session was replaced
  // Note: Logout is already handled in AuthContext, we just show the message and redirect
  useEffect(() => {
    // Only show message if it's a new message and we haven't shown it yet
    if (logoutMessage && logoutMessage !== lastLogoutMessage.current && !hasShownMessage.current) {
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
    
    // Reset flag when logoutMessage is cleared
    if (!logoutMessage && hasShownMessage.current) {
      hasShownMessage.current = false
      lastLogoutMessage.current = null
    }
  }, [logoutMessage, clearLogoutMessage, navigate, showWarning])

  return (
    <>
      {/* Blocking overlay prevents all interactions when session is invalid */}
      <SessionBlockingOverlay />
      {children}
    </>
  )
}

