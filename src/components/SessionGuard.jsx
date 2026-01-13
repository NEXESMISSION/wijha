import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'

/**
 * SessionGuard Component
 * 
 * Monitors session validity and displays logout messages
 * when sessions are replaced by another device
 */
export default function SessionGuard({ children }) {
  const { logoutMessage, clearLogoutMessage } = useAuth()
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
      
      // Show the message
      showWarning(
        logoutMessage,
        'انتهت الجلسة',
        {
          autoClose: true,
          autoCloseDelay: 8000,
          onConfirm: () => {
            clearLogoutMessage()
            navigate('/login', { replace: true })
          }
        }
      )
      
      // Navigate to login immediately (logout already happened in AuthContext)
      const timer = setTimeout(() => {
        clearLogoutMessage()
        navigate('/login', { replace: true })
      }, 100)
      
      return () => clearTimeout(timer)
    }
    
    // Reset flag when logoutMessage is cleared
    if (!logoutMessage && hasShownMessage.current) {
      hasShownMessage.current = false
      lastLogoutMessage.current = null
    }
  }, [logoutMessage, clearLogoutMessage, navigate]) // Removed showWarning from dependencies

  return <>{children}</>
}

